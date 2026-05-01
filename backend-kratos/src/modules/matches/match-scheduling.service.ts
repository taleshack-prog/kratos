// src/modules/matches/match-scheduling.service.ts
// ============================================================
// Agendamento de Partidas — Kratos Basquete Urbano
//
// Regras de conflito (meia-quadra vs quadra inteira):
//   FULL  → conflita com qualquer reserva no mesmo slot
//   HOME  → conflita com FULL ou outro HOME
//   AWAY  → conflita com FULL ou outro AWAY
//
// Menores de idade:
//   → Só podem agendar se parent_id aprovado na partida
//   → parent_authorizations gerado automaticamente
// ============================================================

import {
  Injectable, Logger, ConflictException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MatchScheduling, MatchStatus } from '../../entities/court.entity';
import { Athlete } from '../../entities/athlete.entity';

export interface CreateMatchDto {
  courtId:        string;
  creatorId:      string;
  modality:       1 | 2 | 3 | 5;
  matchType:      'public' | 'private' | 'practice';
  courtHalf:      'full' | 'home' | 'away';
  minElo:         number;
  scheduledStart: string;  // ISO 8601
  scheduledEnd:   string;  // ISO 8601
}

@Injectable()
export class MatchSchedulingService {
  private readonly logger = new Logger(MatchSchedulingService.name);

  constructor(
    @InjectRepository(MatchScheduling)
    private readonly matchRepo: Repository<MatchScheduling>,
    @InjectRepository(Athlete)
    private readonly athleteRepo: Repository<Athlete>,
    private readonly dataSource: DataSource,
  ) {}

  async createMatch(dto: CreateMatchDto): Promise<MatchScheduling> {
    const creator = await this.athleteRepo.findOneByOrFail({ id: dto.creatorId });
    const start   = new Date(dto.scheduledStart);
    const end     = new Date(dto.scheduledEnd);

    // ── Validações básicas ────────────────────────────────
    if (start >= end) {
      throw new BadRequestException('O horário de início deve ser anterior ao fim.');
    }

    if (start < new Date()) {
      throw new BadRequestException('Não é possível agendar partidas no passado.');
    }

    // ── Verifica Elo mínimo do criador ────────────────────
    const creatorComposite = Math.round(
      creator.eloH * 0.5 + creator.eloC * 0.3 + creator.eloZ * 0.2,
    );
    if (dto.minElo > 0 && creatorComposite < dto.minElo) {
      throw new ForbiddenException(
        `Seu Elo composto (${creatorComposite}) está abaixo do mínimo (${dto.minElo}).`,
      );
    }

    // ── Verifica conflito de horário via função PostgreSQL ─
    const conflictCheck = await this.dataSource.query(
      `SELECT fn_check_schedule_conflict($1, $2, $3, $4) AS has_conflict`,
      [dto.courtId, start, end, dto.courtHalf],
    );

    if (conflictCheck[0]?.has_conflict === true) {
      throw new ConflictException(
        'Já existe uma reserva que conflita com este horário e configuração de quadra.',
      );
    }

    // ── Quórum mínimo baseado na modalidade ──────────────
    //    1v1=2, 2v2=4, 3v3=6, 5v5=10
    const minQuorum = dto.modality * 2;

    return this.dataSource.transaction(async (manager) => {
      const match = manager.create(MatchScheduling, {
        courtId:        dto.courtId,
        creatorId:      dto.creatorId,
        modality:       dto.modality,
        matchType:      dto.matchType,
        courtHalf:      dto.courtHalf,
        minElo:         dto.minElo,
        minQuorum,
        scheduledStart: start,
        scheduledEnd:   end,
        status:         MatchStatus.SCHEDULED,
      });

      const saved = await manager.save(match);

      // Adiciona o criador ao roster automaticamente
      await manager.query(
        `INSERT INTO match_roster (match_id, athlete_id, team_color)
         VALUES ($1, $2, 'home')
         ON CONFLICT DO NOTHING`,
        [saved.id, dto.creatorId],
      );

      // Se criador for menor, gera autorização pendente para o responsável
      if (creator.isMinor && creator.parentId) {
        await manager.query(
          `INSERT INTO parent_authorizations (match_id, minor_id, parent_id, status)
           VALUES ($1, $2, $3, 'pending')
           ON CONFLICT (match_id, minor_id) DO NOTHING`,
          [saved.id, creator.id, creator.parentId],
        );
        this.logger.log(
          `Autorização pendente gerada para menor ${creator.name} | ` +
          `Responsável: ${creator.parentId}`,
        );
      }

      this.logger.log(`Partida criada: ${saved.id} | Quadra: ${dto.courtId}`);
      return saved;
    });
  }

  /** Lista quadras num raio de X km usando PostGIS */
  async findNearbyCourts(lat: number, lng: number, radiusKm = 5): Promise<any[]> {
    return this.dataSource.query(
      `SELECT
          c.id,
          c.name,
          c.address,
          c.status,
          c.opening_hour,
          c.closing_hour,
          ROUND(
            ST_Distance(
              ST_Centroid(c.geom)::geography,
              ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
            ) / 1000, 2
          ) AS distance_km,
          COUNT(ms.id) AS active_matches
       FROM courts c
       LEFT JOIN match_scheduling ms
              ON ms.court_id = c.id
             AND ms.status IN ('scheduled','checkin','ongoing')
             AND ms.scheduled_start >= NOW()
       WHERE c.status = 'active'
         AND ST_DWithin(
               ST_Centroid(c.geom)::geography,
               ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
               $3 * 1000
             )
       GROUP BY c.id
       ORDER BY distance_km ASC`,
      [lat, lng, radiusKm],
    );
  }
}
