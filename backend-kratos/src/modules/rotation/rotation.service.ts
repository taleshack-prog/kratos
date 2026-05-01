// src/modules/rotation/rotation.service.ts
// ============================================================
// Sistema de Revezamento Dinâmico — Kratos Basquete Urbano
//
// Fluxos suportados:
//   none          → sem revezamento
//   queue_single  → 1v1(3), 2v2(5), 3v3(7): fila simples, perdedor sai
//   bench_per_team→ 3v3(8): 1 reserva/time, troca simultânea por consenso
//   three_teams   → 3v3(9+) e 5v5(16+): perdedor sai inteiro, próximo entra
//   winner_stays  → 5v5(11-15): vencedor fica, perdedor reveza (fila parcial)
// ============================================================

import {
  Injectable, Logger, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

// ── Tipos ────────────────────────────────────────────────────

export type RotationMode =
  | 'none'
  | 'queue_single'
  | 'bench_per_team'
  | 'three_teams'
  | 'winner_stays';

export type TeamLabel = 'A' | 'B' | 'C';
export type GameResult = 'A' | 'B' | 'C' | 'draw';

export interface RotationConfig {
  matchId:            string;
  rotationMode:       RotationMode;
  totalPlayers:       number;
  playersPerTeam:     number;
  activeTeams:        number;
  benchCount:         number;
  formationMethod:    'captain_draft' | 'consensus';
  captainAId:         string | null;
  captainBId:         string | null;
  captainCId:         string | null;
  requiresTimer:      boolean;
  gameDurationMinutes: number | null;
}

export interface GameEndDto {
  matchId:     string;
  winningTeam: GameResult;
  initiatedBy: string; // athleteId que registrou o resultado
  gameRound:   number;
}

export interface BenchConfirmDto {
  matchId:   string;
  teamLabel: TeamLabel;
  athleteId: string; // deve ser o capitão do time
  gameRound: number;
}

export interface RotationResult {
  rotationMode:  RotationMode;
  gameRound:     number;
  teamsActive:   TeamLabel[];
  teamsWaiting:  TeamLabel[];
  athletesOut:   Array<{ athleteId: string; teamLabel: TeamLabel }>;
  athletesIn:    Array<{ athleteId: string; teamLabel: TeamLabel }>;
  message:       string;
  requiresConsensus: boolean;
  timerStarted:  boolean;
}

@Injectable()
export class RotationService {
  private readonly logger = new Logger(RotationService.name);

  constructor(private readonly dataSource: DataSource) {}

  // ──────────────────────────────────────────────────────────
  // PÚBLICO: Inicializa rotação após quórum P2P atingido
  // ──────────────────────────────────────────────────────────

  async initializeRotation(matchId: string): Promise<RotationConfig> {
    await this.dataSource.query(
      `SELECT fn_initialize_rotation($1)`,
      [matchId],
    );

    return this.getConfig(matchId);
  }

  async getConfig(matchId: string): Promise<RotationConfig> {
    const rows = await this.dataSource.query(
      `SELECT * FROM match_rotation_config WHERE match_id = $1`,
      [matchId],
    );
    if (!rows.length) {
      throw new NotFoundException(`Configuração de rotação não encontrada para partida ${matchId}.`);
    }
    const r = rows[0];
    return {
      matchId:            r.match_id,
      rotationMode:       r.rotation_mode,
      totalPlayers:       r.total_players,
      playersPerTeam:     r.players_per_team,
      activeTeams:        r.active_teams,
      benchCount:         r.bench_count,
      formationMethod:    r.formation_method,
      captainAId:         r.captain_a_id,
      captainBId:         r.captain_b_id,
      captainCId:         r.captain_c_id,
      requiresTimer:      r.requires_timer,
      gameDurationMinutes: r.game_duration_minutes,
    };
  }

  // ──────────────────────────────────────────────────────────
  // PÚBLICO: Registra fim de rodada e executa a rotação
  // ──────────────────────────────────────────────────────────

  async processGameEnd(dto: GameEndDto): Promise<RotationResult> {
    const config = await this.getConfig(dto.matchId);

    this.logger.log(
      `Game end — Partida: ${dto.matchId} | Modo: ${config.rotationMode} | ` +
      `Vencedor: ${dto.winningTeam} | Rodada: ${dto.gameRound}`,
    );

    switch (config.rotationMode) {
      case 'none':
        return this.handleNone(dto, config);
      case 'queue_single':
        return this.handleQueueSingle(dto, config);
      case 'bench_per_team':
        return this.handleBenchPerTeam(dto, config);
      case 'three_teams':
        return this.handleThreeTeams(dto, config);
      case 'winner_stays':
        return this.handleWinnerStays(dto, config);
      default:
        throw new BadRequestException(`Modo de rotação desconhecido: ${config.rotationMode}`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // PÚBLICO: Confirma consenso de troca (bench_per_team)
  // ──────────────────────────────────────────────────────────

  async confirmBenchSwap(dto: BenchConfirmDto): Promise<{
    allConfirmed: boolean;
    confirmations: Record<TeamLabel, boolean>;
    message: string;
  }> {
    // Valida que o atleta é capitão do time informado
    await this.validateCaptain(dto.matchId, dto.teamLabel, dto.athleteId);

    // Busca o consenso pendente da rodada
    const consensus = await this.dataSource.query(
      `SELECT * FROM bench_consensus
       WHERE match_id = $1
         AND consensus_type = 'bench_swap'
         AND game_round = $2
         AND status = 'pending'`,
      [dto.matchId, dto.gameRound],
    );

    if (!consensus.length) {
      throw new NotFoundException(
        `Nenhum consenso de troca pendente para a rodada ${dto.gameRound}.`,
      );
    }

    const c = consensus[0];

    // Verifica expiração
    if (new Date(c.expires_at) < new Date()) {
      await this.dataSource.query(
        `UPDATE bench_consensus SET status = 'expired' WHERE id = $1`,
        [c.id],
      );
      throw new BadRequestException('O consenso expirou (5 minutos). Inicie um novo.');
    }

    // Marca o time como confirmado
    const field = `team_${dto.teamLabel.toLowerCase()}_confirmed`;
    await this.dataSource.query(
      `UPDATE bench_consensus SET ${field} = TRUE WHERE id = $1`,
      [c.id],
    );

    // Busca estado atual após update
    const updated = await this.dataSource.query(
      `SELECT * FROM bench_consensus WHERE id = $1`,
      [c.id],
    );
    const u = updated[0];

    const confirmations: Record<TeamLabel, boolean> = {
      A: u.team_a_confirmed,
      B: u.team_b_confirmed,
      C: u.team_c_confirmed,
    };

    const config = await this.getConfig(dto.matchId);
    const allConfirmed = config.activeTeams === 2
      ? u.team_a_confirmed && u.team_b_confirmed
      : u.team_a_confirmed && u.team_b_confirmed && u.team_c_confirmed;

    if (allConfirmed) {
      await this.executeBenchSwap(dto.matchId, dto.gameRound, c.id, config);
    }

    return {
      allConfirmed,
      confirmations,
      message: allConfirmed
        ? 'Consenso atingido! Reservas trocadas simultaneamente.'
        : `Aguardando confirmação dos outros times.`,
    };
  }

  // ──────────────────────────────────────────────────────────
  // PRIVADO: Handlers por modo de rotação
  // ──────────────────────────────────────────────────────────

  /**
   * none — Sem revezamento. Apenas registra o evento.
   */
  private async handleNone(dto: GameEndDto, config: RotationConfig): Promise<RotationResult> {
    await this.logRotationEvent(dto.matchId, 'game_ended', dto);
    return {
      rotationMode: 'none',
      gameRound:    dto.gameRound,
      teamsActive:  ['A', 'B'],
      teamsWaiting: [],
      athletesOut:  [],
      athletesIn:   [],
      message: 'Partida registrada. Nenhum revezamento configurado.',
      requiresConsensus: false,
      timerStarted: false,
    };
  }

  /**
   * queue_single — Perdedor sai, próximo da fila entra.
   * Usado em: 1v1(3+), 2v2(5+), 3v3(7)
   */
  private async handleQueueSingle(dto: GameEndDto, config: RotationConfig): Promise<RotationResult> {
    if (dto.winningTeam === 'draw') {
      throw new BadRequestException('queue_single não suporta empate. Defina um vencedor.');
    }

    const losingTeam = dto.winningTeam === 'A' ? 'B' : 'A';

    // Pega os atletas do time perdedor (em quadra)
    const losers = await this.getTeamPlayers(dto.matchId, losingTeam, 'player');

    // Pega o próximo da fila (bench, menor queue_pos)
    const nextInQueue = await this.dataSource.query(
      `SELECT mtm.athlete_id, mtm.id AS member_id, mt.team_label
       FROM match_team_members mtm
       JOIN match_teams mt ON mt.id = mtm.team_id
       WHERE mtm.match_id = $1
         AND mtm.role = 'bench'
       ORDER BY mtm.queue_pos ASC
       LIMIT $2`,
      [dto.matchId, config.playersPerTeam],
    );

    if (!nextInQueue.length) {
      this.logger.warn(`Fila vazia na partida ${dto.matchId}. Sem revezamento possível.`);
      return {
        rotationMode: 'queue_single',
        gameRound: dto.gameRound + 1,
        teamsActive: ['A', 'B'],
        teamsWaiting: [],
        athletesOut: [],
        athletesIn: [],
        message: 'Fila vazia. O jogo continua com os mesmos times.',
        requiresConsensus: false,
        timerStarted: false,
      };
    }

    return this.dataSource.transaction(async (manager) => {
      // Move perdedores para o final da fila
      let maxQueuePos = config.playersPerTeam + config.benchCount;
      for (const loser of losers) {
        await manager.query(
          `UPDATE match_team_members
           SET role = 'bench', queue_pos = $1
           WHERE match_id = $2 AND athlete_id = $3`,
          [++maxQueuePos, dto.matchId, loser.athlete_id],
        );
      }

      // Move próximos da fila para o time perdedor (assumem o label do time)
      for (const next of nextInQueue) {
        await manager.query(
          `UPDATE match_team_members
           SET role = 'player', queue_pos = NULL,
               team_id = (SELECT id FROM match_teams WHERE match_id = $1 AND team_label = $2)
           WHERE match_id = $1 AND athlete_id = $3`,
          [dto.matchId, losingTeam, next.athlete_id],
        );
      }

      await this.logRotationEvent(dto.matchId, 'rotation_triggered', dto, {
        athletesOut: losers.map(l => ({ athleteId: l.athlete_id, teamLabel: losingTeam })),
        athletesIn:  nextInQueue.map(n => ({ athleteId: n.athlete_id, teamLabel: losingTeam })),
      });

      return {
        rotationMode: 'queue_single',
        gameRound: dto.gameRound + 1,
        teamsActive: ['A', 'B'],
        teamsWaiting: [],
        athletesOut: losers.map(l => ({ athleteId: l.athlete_id, teamLabel: losingTeam })),
        athletesIn:  nextInQueue.map(n => ({ athleteId: n.athlete_id, teamLabel: losingTeam as TeamLabel })),
        message: `Time ${losingTeam} substituído. Próximos da fila entram.`,
        requiresConsensus: false,
        timerStarted: false,
      };
    });
  }

  /**
   * bench_per_team — 1 reserva por time, troca simultânea por consenso.
   * Usado em: 3v3(8)
   * Fluxo: jogo acaba → sistema abre consenso → ambos os capitães confirmam → troca ocorre
   */
  private async handleBenchPerTeam(dto: GameEndDto, config: RotationConfig): Promise<RotationResult> {
    // Abre um novo consenso de troca para esta rodada
    await this.dataSource.query(
      `INSERT INTO bench_consensus
          (match_id, consensus_type, game_round,
           team_a_confirmed, team_b_confirmed, team_c_confirmed, status)
       VALUES ($1, 'bench_swap', $2, FALSE, FALSE, TRUE, 'pending')`,
      [dto.matchId, dto.gameRound + 1],
    );

    await this.logRotationEvent(dto.matchId, 'game_ended', dto);

    return {
      rotationMode: 'bench_per_team',
      gameRound: dto.gameRound + 1,
      teamsActive: ['A', 'B'],
      teamsWaiting: [],
      athletesOut: [],
      athletesIn: [],
      message: `Rodada ${dto.gameRound} finalizada. ` +
               `Aguardando confirmação de ambos os capitães para trocar reservas simultaneamente.`,
      requiresConsensus: true,
      timerStarted: false,
    };
  }

  /**
   * three_teams — Time C esperando. Perdedor sai inteiro, Time C entra.
   * Usado em: 3v3(9+) e 5v5(16-21) com timer de 10min
   */
  private async handleThreeTeams(dto: GameEndDto, config: RotationConfig): Promise<RotationResult> {
    if (dto.winningTeam === 'draw') {
      throw new BadRequestException(
        'three_teams não suporta empate. O vencedor fica em quadra.',
      );
    }

    const losingTeam  = dto.winningTeam === 'A' ? 'B' : 'A';
    const waitingTeam = 'C'; // sempre C no esquema inicial

    // Determina o novo time C (quem acabou de perder)
    const losers   = await this.getTeamPlayers(dto.matchId, losingTeam as TeamLabel, 'player');
    const incoming = await this.getTeamPlayers(dto.matchId, waitingTeam, 'bench');

    return this.dataSource.transaction(async (manager) => {
      // Time perdedor → aguardando (assume label C)
      await manager.query(
        `UPDATE match_teams SET status = 'waiting', team_label = 'C'
         WHERE match_id = $1 AND team_label = $2`,
        [dto.matchId, losingTeam],
      );

      // Atualiza members do perdedor para bench
      await manager.query(
        `UPDATE match_team_members SET role = 'bench'
         WHERE match_id = $1
           AND team_id = (SELECT id FROM match_teams WHERE match_id = $1 AND team_label = 'C')`,
        [dto.matchId],
      );

      // Time C (esperando) → entra com o label do perdedor
      await manager.query(
        `UPDATE match_teams SET status = 'active', team_label = $2
         WHERE match_id = $1 AND team_label = 'C' AND status = 'waiting'
         -- Pega o time que era C ANTES da update acima
         `,
        [dto.matchId, losingTeam],
      );

      // Atualiza members para player
      await manager.query(
        `UPDATE match_team_members SET role = 'player'
         WHERE match_id = $1
           AND team_id = (
               SELECT id FROM match_teams
               WHERE match_id = $1 AND team_label = $2
           )`,
        [dto.matchId, losingTeam],
      );

      await this.logRotationEvent(dto.matchId, 'team_eliminated', dto, {
        athletesOut: losers.map(l  => ({ athleteId: l.athlete_id, teamLabel: losingTeam  as TeamLabel })),
        athletesIn:  incoming.map(i => ({ athleteId: i.athlete_id, teamLabel: losingTeam as TeamLabel })),
      });

      const timerStarted = config.requiresTimer;
      if (timerStarted) {
        this.logger.log(
          `Timer de ${config.gameDurationMinutes}min iniciado. ` +
          `Partida ${dto.matchId} — Rodada ${dto.gameRound + 1}`,
        );
      }

      return {
        rotationMode: 'three_teams',
        gameRound: dto.gameRound + 1,
        teamsActive:  [dto.winningTeam as TeamLabel, losingTeam as TeamLabel],
        teamsWaiting: [waitingTeam],
        athletesOut:  losers.map(l   => ({ athleteId: l.athlete_id,   teamLabel: losingTeam  as TeamLabel })),
        athletesIn:   incoming.map(i => ({ athleteId: i.athlete_id, teamLabel: losingTeam as TeamLabel })),
        message: `Time ${losingTeam} saiu. Time ${waitingTeam} entrou. ` +
                 (timerStarted ? `Timer de ${config.gameDurationMinutes} minutos iniciado.` : ''),
        requiresConsensus: false,
        timerStarted,
      };
    });
  }

  /**
   * winner_stays — Vencedor fica, perdedor reveza com fila parcial.
   * Usado em: 5v5(11-15)
   */
  private async handleWinnerStays(dto: GameEndDto, config: RotationConfig): Promise<RotationResult> {
    if (dto.winningTeam === 'draw') {
      throw new BadRequestException('winner_stays não suporta empate.');
    }

    const losingTeam = dto.winningTeam === 'A' ? 'B' : 'A';

    // Pega os atletas na fila (bench, menor queue_pos primeiro)
    const nextInQueue = await this.dataSource.query(
      `SELECT mtm.athlete_id, mtm.queue_pos
       FROM match_team_members mtm
       WHERE mtm.match_id = $1 AND mtm.role = 'bench'
       ORDER BY mtm.queue_pos ASC
       LIMIT $2`,
      [dto.matchId, config.playersPerTeam],
    );

    if (!nextInQueue.length) {
      return {
        rotationMode: 'winner_stays',
        gameRound: dto.gameRound + 1,
        teamsActive: ['A', 'B'],
        teamsWaiting: [],
        athletesOut: [],
        athletesIn: [],
        message: 'Fila esgotada. Vencedor continua. O mesmo time perdedor joga novamente.',
        requiresConsensus: false,
        timerStarted: false,
      };
    }

    const losers = await this.getTeamPlayers(dto.matchId, losingTeam as TeamLabel, 'player');

    return this.dataSource.transaction(async (manager) => {
      let maxPos = config.benchCount + config.playersPerTeam;

      // Perdedores vão para o final da fila
      for (const loser of losers) {
        await manager.query(
          `UPDATE match_team_members
           SET role = 'bench', queue_pos = $1
           WHERE match_id = $2 AND athlete_id = $3`,
          [++maxPos, dto.matchId, loser.athlete_id],
        );
      }

      // Próximos da fila entram como novo time perdedor
      for (const next of nextInQueue) {
        await manager.query(
          `UPDATE match_team_members
           SET role = 'player', queue_pos = NULL,
               team_id = (SELECT id FROM match_teams WHERE match_id = $1 AND team_label = $2)
           WHERE match_id = $1 AND athlete_id = $3`,
          [dto.matchId, losingTeam, next.athlete_id],
        );
      }

      await this.logRotationEvent(dto.matchId, 'rotation_triggered', dto, {
        athletesOut: losers.map(l   => ({ athleteId: l.athlete_id,   teamLabel: losingTeam as TeamLabel })),
        athletesIn:  nextInQueue.map(n => ({ athleteId: n.athlete_id, teamLabel: losingTeam as TeamLabel })),
      });

      return {
        rotationMode: 'winner_stays',
        gameRound: dto.gameRound + 1,
        teamsActive: ['A', 'B'],
        teamsWaiting: [],
        athletesOut: losers.map(l   => ({ athleteId: l.athlete_id,   teamLabel: losingTeam as TeamLabel })),
        athletesIn:  nextInQueue.map(n => ({ athleteId: n.athlete_id, teamLabel: losingTeam as TeamLabel })),
        message: `Vencedor (Time ${dto.winningTeam}) permanece. ` +
                 `Time ${losingTeam} substituído pelos próximos da fila.`,
        requiresConsensus: false,
        timerStarted: false,
      };
    });
  }

  // ──────────────────────────────────────────────────────────
  // PRIVADO: Executa troca de bench_per_team após consenso
  // ──────────────────────────────────────────────────────────

  private async executeBenchSwap(
    matchId: string,
    gameRound: number,
    consensusId: string,
    config: RotationConfig,
  ): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const athletesOut: Array<{ athleteId: string; teamLabel: TeamLabel }> = [];
      const athletesIn:  Array<{ athleteId: string; teamLabel: TeamLabel }> = [];

      for (const team of ['A', 'B'] as TeamLabel[]) {
        // Pega o bench do time
        const bench = await manager.query(
          `SELECT mtm.athlete_id
           FROM match_team_members mtm
           JOIN match_teams mt ON mt.id = mtm.team_id
           WHERE mtm.match_id = $1 AND mt.team_label = $2 AND mtm.role = 'bench'
           LIMIT 1`,
          [matchId, team],
        );

        // Pega um jogador em quadra para sair (último a entrar, FIFO)
        const onCourt = await manager.query(
          `SELECT mtm.athlete_id
           FROM match_team_members mtm
           JOIN match_teams mt ON mt.id = mtm.team_id
           WHERE mtm.match_id = $1 AND mt.team_label = $2 AND mtm.role = 'player'
           ORDER BY mtm.joined_at ASC  -- o mais antigo sai
           LIMIT 1`,
          [matchId, team],
        );

        if (bench.length && onCourt.length) {
          // Troca: bench → player, player → bench
          await manager.query(
            `UPDATE match_team_members SET role = 'player', queue_pos = NULL
             WHERE match_id = $1 AND athlete_id = $2`,
            [matchId, bench[0].athlete_id],
          );
          await manager.query(
            `UPDATE match_team_members SET role = 'bench', queue_pos = 1
             WHERE match_id = $1 AND athlete_id = $2`,
            [matchId, onCourt[0].athlete_id],
          );

          athletesOut.push({ athleteId: onCourt[0].athlete_id, teamLabel: team });
          athletesIn.push({ athleteId: bench[0].athlete_id,    teamLabel: team });
        }
      }

      // Fecha o consenso
      await manager.query(
        `UPDATE bench_consensus
         SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [consensusId],
      );

      // Registra o evento
      await manager.query(
        `INSERT INTO match_rotation_events
            (match_id, event_type, game_round, athletes_out, athletes_in)
         VALUES ($1, 'bench_swap', $2, $3, $4)`,
        [matchId, gameRound, JSON.stringify(athletesOut), JSON.stringify(athletesIn)],
      );

      this.logger.log(
        `Bench swap executado (consenso) — Partida ${matchId} | Rodada ${gameRound}`,
      );
    });
  }

  // ──────────────────────────────────────────────────────────
  // PRIVADO: Helpers
  // ──────────────────────────────────────────────────────────

  private async getTeamPlayers(matchId: string, teamLabel: TeamLabel, role: 'player' | 'bench') {
    return this.dataSource.query(
      `SELECT mtm.athlete_id
       FROM match_team_members mtm
       JOIN match_teams mt ON mt.id = mtm.team_id
       WHERE mtm.match_id = $1 AND mt.team_label = $2 AND mtm.role = $3`,
      [matchId, teamLabel, role],
    );
  }

  private async validateCaptain(matchId: string, teamLabel: TeamLabel, athleteId: string) {
    const result = await this.dataSource.query(
      `SELECT captain_id FROM match_teams
       WHERE match_id = $1 AND team_label = $2`,
      [matchId, teamLabel],
    );
    if (!result.length || result[0].captain_id !== athleteId) {
      throw new BadRequestException(
        `Somente o capitão do Time ${teamLabel} pode confirmar o consenso.`,
      );
    }
  }

  private async logRotationEvent(
    matchId: string,
    eventType: string,
    dto: GameEndDto,
    extra?: {
      athletesOut?: Array<{ athleteId: string; teamLabel: TeamLabel }>;
      athletesIn?:  Array<{ athleteId: string; teamLabel: TeamLabel }>;
    },
  ) {
    await this.dataSource.query(
      `INSERT INTO match_rotation_events
          (match_id, event_type, winning_team, losing_team,
           athletes_out, athletes_in, initiated_by, game_round)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        matchId,
        eventType,
        dto.winningTeam !== 'draw' ? dto.winningTeam : null,
        dto.winningTeam !== 'draw' ? (dto.winningTeam === 'A' ? 'B' : 'A') : null,
        JSON.stringify(extra?.athletesOut ?? []),
        JSON.stringify(extra?.athletesIn  ?? []),
        dto.initiatedBy,
        dto.gameRound,
      ],
    );
  }
}
