// src/modules/reputation/elo.service.ts
// ============================================================
// Algoritmo Elo H+C+Z — Kratos Basquete Urbano
// Fórmula:
//   Elo_final = Elo_atual + K × (Resultado - E) + (H×0.5) + (C×0.3) + (Z×0.2)
//
// Onde:
//   K        = Fator de volatilidade (32 para iniciantes, 16 para veteranos)
//   Resultado= 1.0 (vitória), 0.5 (empate), 0.0 (derrota)
//   E        = Probabilidade esperada de vitória (fórmula Elo clássica)
//   H        = Delta de Habilidade (pontos técnicos da partida)
//   C        = Delta de Comportamento / Fair-play (avaliação dos pares, -10 a +10)
//   Z        = Delta de Zeladoria (bônus por report válido: +5 por report)
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Athlete } from '../../entities/athlete.entity';

export interface EloUpdateInput {
  athleteId:  string;
  opponentId: string;
  result:     'win' | 'draw' | 'loss';
  /** Avaliação de fair-play pelo adversário: -10 a +10 */
  fairPlayDelta: number;
  /** Número de reports de zeladoria válidos nesta sessão */
  zeladoriaReports?: number;
}

export interface EloUpdateResult {
  athleteId:   string;
  eloHBefore:  number;
  eloHAfter:   number;
  eloCBefore:  number;
  eloCAfter:   number;
  eloZBefore:  number;
  eloZAfter:   number;
  compositeBefore: number;
  compositeAfter:  number;
}

@Injectable()
export class EloService {
  private readonly logger = new Logger(EloService.name);

  constructor(
    @InjectRepository(Athlete)
    private readonly athleteRepo: Repository<Athlete>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Retorna o fator K baseado no número de partidas.
   * K=32 para novatos (<30 partidas), K=16 para veteranos.
   */
  private kFactor(eloScore: number): number {
    return eloScore < 1600 ? 32 : 16;
  }

  /**
   * Probabilidade esperada de vitória do atleta A contra B.
   */
  private expectedScore(eloA: number, eloB: number): number {
    return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  }

  /**
   * Calcula e persiste a atualização de Elo após uma partida.
   */
  async updateAfterMatch(input: EloUpdateInput): Promise<EloUpdateResult> {
    const [athlete, opponent] = await Promise.all([
      this.athleteRepo.findOneByOrFail({ id: input.athleteId }),
      this.athleteRepo.findOneByOrFail({ id: input.opponentId }),
    ]);

    const resultValue = input.result === 'win' ? 1.0
                      : input.result === 'draw' ? 0.5
                      : 0.0;

    // ── Elo H (Habilidade) ─────────────────────────────────
    const k  = this.kFactor(athlete.eloH);
    const e  = this.expectedScore(athlete.eloH, opponent.eloH);
    const eloHDelta = Math.round(k * (resultValue - e));
    const eloHBefore = athlete.eloH;
    const eloHAfter  = Math.max(0, athlete.eloH + eloHDelta);

    // ── Elo C (Comportamento / Fair-play) ─────────────────
    const eloCDelta = this.clamp(Math.round(input.fairPlayDelta * 0.3), -5, 5);
    const eloCBefore = athlete.eloC;
    const eloCAfter  = Math.max(0, athlete.eloC + eloCDelta);

    // ── Elo Z (Zeladoria) ─────────────────────────────────
    const zeladoriaBonus = (input.zeladoriaReports ?? 0) * 5;
    const eloZDelta  = Math.round(zeladoriaBonus * 0.2);
    const eloZBefore = athlete.eloZ;
    const eloZAfter  = Math.max(0, athlete.eloZ + eloZDelta);

    // ── Persiste em transação ──────────────────────────────
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Athlete, athlete.id, {
        eloH: eloHAfter,
        eloC: eloCAfter,
        eloZ: eloZAfter,
      });
    });

    this.logger.log(
      `Elo atualizado para ${athlete.name}: H ${eloHBefore}→${eloHAfter} | ` +
      `C ${eloCBefore}→${eloCAfter} | Z ${eloZBefore}→${eloZAfter}`,
    );

    return {
      athleteId:       input.athleteId,
      eloHBefore, eloHAfter,
      eloCBefore, eloCAfter,
      eloZBefore, eloZAfter,
      compositeBefore: this.composite(eloHBefore, eloCBefore, eloZBefore),
      compositeAfter:  this.composite(eloHAfter, eloCAfter, eloZAfter),
    };
  }

  /** Elo composto para ranking geral: H×0.5 + C×0.3 + Z×0.2 */
  composite(eloH: number, eloC: number, eloZ: number): number {
    return Math.round(eloH * 0.5 + eloC * 0.3 + eloZ * 0.2);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
