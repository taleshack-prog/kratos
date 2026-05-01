// src/modules/rotation/team-formation.service.ts
// ============================================================
// Formação de Times — Kratos Basquete Urbano
//
// Dois modos:
//   captain_draft → Capitães com ranking elegem e fazem snake draft
//   consensus     → Sem ranking suficiente: votação direta no app
//
// Snake Draft (captain_draft):
//   Times A e B: A1 → B1 → B2 → A2 → A3 → B3 → ...
//   Times A, B e C (three_teams):
//     Rodada 1: A → B → C
//     Rodada 2: C → B → A
//     Rodada 3: A → B → C ... (serpentina)
// ============================================================

import {
  Injectable, Logger, BadRequestException, ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { TeamLabel } from './rotation.service';

export interface DraftPickDto {
  matchId:          string;
  captainId:        string;
  pickedAthleteId:  string;
  pickNumber:       number;
}

export interface ConsensusTeamDto {
  matchId:   string;
  athleteId: string;  // atleta que está se alocando
  teamLabel: TeamLabel;
}

export interface TeamFormationState {
  matchId:          string;
  formationMethod:  'captain_draft' | 'consensus';
  isComplete:       boolean;
  teams: Array<{
    label:     TeamLabel;
    captainId: string | null;
    players:   Array<{ athleteId: string; name: string; eloComposite: number }>;
    bench:     Array<{ athleteId: string; name: string }>;
  }>;
  nextPickCaptainId: string | null;
  nextPickNumber:    number;
  remainingAthletes: Array<{ athleteId: string; name: string; eloComposite: number }>;
}

@Injectable()
export class TeamFormationService {
  private readonly logger = new Logger(TeamFormationService.name);

  constructor(private readonly dataSource: DataSource) {}

  // ──────────────────────────────────────────────────────────
  // Estado atual da formação
  // ──────────────────────────────────────────────────────────

  async getFormationState(matchId: string): Promise<TeamFormationState> {
    const config = await this.dataSource.query(
      `SELECT * FROM match_rotation_config WHERE match_id = $1`,
      [matchId],
    );
    if (!config.length) throw new BadRequestException('Configuração de rotação não encontrada.');
    const cfg = config[0];

    const teams = await this.dataSource.query(
      `SELECT
          mt.team_label,
          mt.captain_id,
          jsonb_agg(jsonb_build_object(
              'athleteId',     a.id,
              'name',          a.name,
              'eloComposite',  ROUND((a.elo_h * 0.5 + a.elo_c * 0.3 + a.elo_z * 0.2)::NUMERIC, 0)
          ) ORDER BY mtm.joined_at) FILTER (WHERE mtm.role = 'player') AS players,
          jsonb_agg(jsonb_build_object(
              'athleteId', a.id,
              'name',      a.name
          )) FILTER (WHERE mtm.role = 'bench') AS bench
       FROM match_teams mt
       LEFT JOIN match_team_members mtm ON mtm.team_id = mt.id AND mtm.match_id = mt.match_id
       LEFT JOIN athletes a ON a.id = mtm.athlete_id
       WHERE mt.match_id = $1
       GROUP BY mt.team_label, mt.captain_id
       ORDER BY mt.team_label`,
      [matchId],
    );

    const remaining = await this.dataSource.query(
      `SELECT
          a.id AS "athleteId",
          a.name,
          ROUND((a.elo_h * 0.5 + a.elo_c * 0.3 + a.elo_z * 0.2)::NUMERIC, 0) AS "eloComposite"
       FROM match_roster mr
       JOIN athletes a ON a.id = mr.athlete_id
       WHERE mr.match_id = $1
         AND NOT EXISTS (
             SELECT 1 FROM match_team_members mtm
             WHERE mtm.match_id = $1 AND mtm.athlete_id = mr.athlete_id
         )
       ORDER BY "eloComposite" DESC`,
      [matchId],
    );

    const nextPick = await this.getNextPickInfo(matchId, cfg);

    const totalSlots = cfg.players_per_team * cfg.active_teams + cfg.bench_count;
    const assignedCount = await this.dataSource.query(
      `SELECT COUNT(*) AS cnt FROM match_team_members WHERE match_id = $1`,
      [matchId],
    );
    const isComplete = parseInt(assignedCount[0].cnt, 10) >= totalSlots;

    return {
      matchId,
      formationMethod:   cfg.formation_method,
      isComplete,
      teams:             teams.map(t => ({
        label:     t.team_label,
        captainId: t.captain_id,
        players:   t.players ?? [],
        bench:     t.bench   ?? [],
      })),
      nextPickCaptainId: nextPick?.captainId ?? null,
      nextPickNumber:    nextPick?.pickNumber ?? 0,
      remainingAthletes: remaining,
    };
  }

  // ──────────────────────────────────────────────────────────
  // CAPTAIN DRAFT: Snake Draft
  // ──────────────────────────────────────────────────────────

  async makeDraftPick(dto: DraftPickDto): Promise<TeamFormationState> {
    const config = await this.dataSource.query(
      `SELECT * FROM match_rotation_config WHERE match_id = $1`,
      [dto.matchId],
    );
    const cfg = config[0];

    if (cfg.formation_method !== 'captain_draft') {
      throw new BadRequestException('Esta partida usa consenso, não captain_draft.');
    }

    // Valida que é a vez deste capitão
    const nextPick = await this.getNextPickInfo(dto.matchId, cfg);
    if (!nextPick || nextPick.captainId !== dto.captainId) {
      throw new BadRequestException(
        `Não é a vez do capitão ${dto.captainId}. ` +
        `Próximo pick: Capitão ${nextPick?.captainId}.`,
      );
    }

    // Valida que o atleta está no roster e ainda não foi escolhido
    const available = await this.dataSource.query(
      `SELECT mr.athlete_id
       FROM match_roster mr
       WHERE mr.match_id = $1
         AND mr.athlete_id = $2
         AND NOT EXISTS (
             SELECT 1 FROM match_team_members mtm
             WHERE mtm.match_id = $1 AND mtm.athlete_id = $2
         )`,
      [dto.matchId, dto.pickedAthleteId],
    );

    if (!available.length) {
      throw new ConflictException(
        'Atleta indisponível: já escolhido ou não está no roster desta partida.',
      );
    }

    // Capitão não escolhe a si mesmo (já foi alocado como player do próprio time)
    const captainTeam = this.getCaptainTeam(cfg, dto.captainId);
    const isBenchPick = await this.isBenchPosition(dto.matchId, captainTeam, cfg);

    await this.dataSource.transaction(async (manager) => {
      // Adiciona ao time do capitão
      const teamId = await manager.query(
        `SELECT id FROM match_teams WHERE match_id = $1 AND team_label = $2`,
        [dto.matchId, captainTeam],
      );

      await manager.query(
        `INSERT INTO match_team_members (match_id, team_id, athlete_id, role)
         VALUES ($1, $2, $3, $4)`,
        [dto.matchId, teamId[0].id, dto.pickedAthleteId, isBenchPick ? 'bench' : 'player'],
      );

      // Registra o pick
      await manager.query(
        `INSERT INTO captain_draft_picks
            (match_id, round, pick_number, captain_id, team_label, picked_athlete_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          dto.matchId,
          Math.ceil(dto.pickNumber / cfg.active_teams),
          dto.pickNumber,
          dto.captainId,
          captainTeam,
          dto.pickedAthleteId,
        ],
      );
    });

    this.logger.log(
      `Draft pick #${dto.pickNumber}: Capitão ${dto.captainId} ` +
      `escolheu ${dto.pickedAthleteId} → Time ${captainTeam}`,
    );

    return this.getFormationState(dto.matchId);
  }

  // ──────────────────────────────────────────────────────────
  // CONSENSUS: Atleta se aloca num time
  // ──────────────────────────────────────────────────────────

  async consensusJoinTeam(dto: ConsensusTeamDto): Promise<TeamFormationState> {
    const config = await this.dataSource.query(
      `SELECT * FROM match_rotation_config WHERE match_id = $1`,
      [dto.matchId],
    );
    const cfg = config[0];

    if (cfg.formation_method !== 'consensus') {
      throw new BadRequestException('Esta partida usa captain_draft. Use /draft/pick.');
    }

    // Verifica se o atleta já está alocado
    const existing = await this.dataSource.query(
      `SELECT 1 FROM match_team_members WHERE match_id = $1 AND athlete_id = $2`,
      [dto.matchId, dto.athleteId],
    );
    if (existing.length) {
      throw new ConflictException('Você já está alocado em um time nesta partida.');
    }

    // Verifica vagas no time
    const teamPlayers = await this.dataSource.query(
      `SELECT COUNT(*) AS cnt
       FROM match_team_members mtm
       JOIN match_teams mt ON mt.id = mtm.team_id
       WHERE mtm.match_id = $1 AND mt.team_label = $2 AND mtm.role = 'player'`,
      [dto.matchId, dto.teamLabel],
    );

    const currentCount = parseInt(teamPlayers[0].cnt, 10);
    const isBench      = currentCount >= cfg.players_per_team;

    if (isBench && cfg.bench_count === 0) {
      throw new BadRequestException(`Time ${dto.teamLabel} está cheio e não há vagas de banco.`);
    }

    const teamId = await this.dataSource.query(
      `SELECT id FROM match_teams WHERE match_id = $1 AND team_label = $2`,
      [dto.matchId, dto.teamLabel],
    );

    if (!teamId.length) {
      throw new BadRequestException(`Time ${dto.teamLabel} não existe nesta partida.`);
    }

    await this.dataSource.query(
      `INSERT INTO match_team_members (match_id, team_id, athlete_id, role, queue_pos)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        dto.matchId,
        teamId[0].id,
        dto.athleteId,
        isBench ? 'bench' : 'player',
        isBench ? currentCount + 1 : null,
      ],
    );

    this.logger.log(
      `Consenso: Atleta ${dto.athleteId} → Time ${dto.teamLabel} ` +
      `(${isBench ? 'banco' : 'titular'}) | Partida ${dto.matchId}`,
    );

    return this.getFormationState(dto.matchId);
  }

  // ──────────────────────────────────────────────────────────
  // PRIVADO: Helpers do Snake Draft
  // ──────────────────────────────────────────────────────────

  /**
   * Calcula quem faz o próximo pick no snake draft.
   *
   * Com 2 times (A, B), picks: A B B A A B B A ...
   * Com 3 times (A, B, C), picks: A B C C B A A B C ...
   */
  private async getNextPickInfo(
    matchId: string,
    cfg: any,
  ): Promise<{ captainId: string; pickNumber: number } | null> {
    const lastPick = await this.dataSource.query(
      `SELECT MAX(pick_number) AS last_pick FROM captain_draft_picks WHERE match_id = $1`,
      [matchId],
    );

    const nextPickNumber = (lastPick[0]?.last_pick ?? 0) + 1;

    // Gera a ordem do snake para 2 ou 3 times
    const order = this.snakeDraftOrder(cfg.active_teams, nextPickNumber);
    const teamLabel = order as TeamLabel;

    const captainField = `captain_${teamLabel.toLowerCase()}_id`;
    const captainId = cfg[captainField];

    if (!captainId) return null;

    return { captainId, pickNumber: nextPickNumber };
  }

  /**
   * Retorna o label do time que faz o pick N no snake draft.
   * 2 times: A B | B A | A B | B A ...
   * 3 times: A B C | C B A | A B C ...
   */
  private snakeDraftOrder(activeTeams: number, pickNumber: number): string {
    const teams2 = ['A', 'B'];
    const teams3 = ['A', 'B', 'C'];

    if (activeTeams === 2) {
      const pos      = (pickNumber - 1) % 4;
      const pattern  = [0, 1, 1, 0]; // A B B A
      return teams2[pattern[pos]];
    }

    if (activeTeams === 3) {
      const pos     = (pickNumber - 1) % 6;
      const pattern = [0, 1, 2, 2, 1, 0]; // A B C C B A
      return teams3[pattern[pos]];
    }

    return 'A';
  }

  private getCaptainTeam(cfg: any, captainId: string): TeamLabel {
    if (cfg.captain_a_id === captainId) return 'A';
    if (cfg.captain_b_id === captainId) return 'B';
    if (cfg.captain_c_id === captainId) return 'C';
    throw new BadRequestException('Atleta não é capitão nesta partida.');
  }

  /**
   * Verifica se a próxima vaga do time é de banco (já tem jogadores suficientes em quadra).
   */
  private async isBenchPosition(matchId: string, teamLabel: TeamLabel, cfg: any): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT COUNT(*) AS cnt
       FROM match_team_members mtm
       JOIN match_teams mt ON mt.id = mtm.team_id
       WHERE mtm.match_id = $1 AND mt.team_label = $2 AND mtm.role = 'player'`,
      [matchId, teamLabel],
    );
    return parseInt(result[0].cnt, 10) >= cfg.players_per_team;
  }
}
