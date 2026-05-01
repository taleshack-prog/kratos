// src/modules/checkin/checkin-p2p.service.ts
// ============================================================
// Validação P2P de Presença — Kratos Basquete Urbano
//
// Fluxo:
//  1. Atleta A e B fazem check-in via Bluetooth LE (RSSI)
//  2. Cada dispositivo gera e envia um ephemeral_token
//  3. Backend valida:
//     a) RSSI acima do threshold (-80 dBm mínimo)
//     b) GPS dentro do polígono da quadra (ST_Within PostGIS)
//     c) Tokens cruzados entre os dois atletas
//  4. Se os dois check-ins são válidos: fn_update_match_quorum()
// ============================================================

import {
  Injectable, Logger, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

// ── Tipos internos ───────────────────────────────────────────

export interface CheckinP2PDto {
  matchId:        string;
  athleteId:      string;
  validatorId:    string;  // outro atleta que confirma a presença
  bluetoothRssi:  number;  // dBm — threshold mínimo: -80
  latitude:       number;
  longitude:      number;
  ephemeralToken: string;  // token gerado no dispositivo
}

export interface CheckinResult {
  checkInId:     string;
  validated:     boolean;
  message:       string;
  quorumReached: boolean;
}

// ── Constantes ───────────────────────────────────────────────
const RSSI_MIN_DBM = -80;  // abaixo disso = muito longe

@Injectable()
export class CheckinP2PService {
  private readonly logger = new Logger(CheckinP2PService.name);

  constructor(private readonly dataSource: DataSource) {}

  async processCheckin(dto: CheckinP2PDto): Promise<CheckinResult> {
    // 1. Valida RSSI
    if (dto.bluetoothRssi < RSSI_MIN_DBM) {
      throw new BadRequestException(
        `Sinal Bluetooth insuficiente (${dto.bluetoothRssi} dBm). ` +
        `Mínimo: ${RSSI_MIN_DBM} dBm. Aproxime-se da quadra.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // 2. Busca a partida e o polígono da quadra num único JOIN
      const match = await manager.query(
        `SELECT ms.id, ms.min_quorum, ms.status,
                c.geom AS court_geom
         FROM   match_scheduling ms
         JOIN   courts c ON c.id = ms.court_id
         WHERE  ms.id = $1`,
        [dto.matchId],
      );

      if (!match.length) {
        throw new NotFoundException(`Partida ${dto.matchId} não encontrada.`);
      }

      const { min_quorum, status, court_geom } = match[0];

      if (!['scheduled', 'checkin'].includes(status)) {
        throw new BadRequestException(
          `Check-in indisponível. Status atual da partida: ${status}`,
        );
      }

      // 3. Valida se o GPS está DENTRO do polígono da quadra
      const geoCheck = await manager.query(
        `SELECT ST_Within(
            ST_SetSRID(ST_MakePoint($1, $2), 4326),
            $3::geometry
         ) AS inside`,
        [dto.longitude, dto.latitude, court_geom],
      );

      const isInsideCourt = geoCheck[0]?.inside === true;

      if (!isInsideCourt) {
        this.logger.warn(
          `Atleta ${dto.athleteId} fora do polígono da quadra. ` +
          `GPS: ${dto.latitude},${dto.longitude}`,
        );
        throw new BadRequestException(
          'Sua localização não está dentro da quadra. ' +
          'Certifique-se de estar no local e com GPS ativado.',
        );
      }

      // 4. Upsert do check-in (validated=FALSE até cruzar tokens)
      const inserted = await manager.query(
        `INSERT INTO checkins_p2p
            (match_id, athlete_id, validator_id, bluetooth_rssi,
             gps_point, ephemeral_token, validated)
         VALUES ($1, $2, $3, $4,
                 ST_SetSRID(ST_MakePoint($5, $6), 4326),
                 $7, FALSE)
         ON CONFLICT (match_id, athlete_id)
         DO UPDATE SET
            bluetooth_rssi  = EXCLUDED.bluetooth_rssi,
            gps_point       = EXCLUDED.gps_point,
            ephemeral_token = EXCLUDED.ephemeral_token,
            checkin_time    = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          dto.matchId, dto.athleteId, dto.validatorId,
          dto.bluetoothRssi, dto.longitude, dto.latitude,
          dto.ephemeralToken,
        ],
      );

      const checkInId = inserted[0].id;

      // 5. Cruzamento de tokens: valida o check-in do validator_id
      //    (se o par também enviou token e está no mesmo check-in)
      const tokenCross = await manager.query(
        `SELECT id FROM checkins_p2p
         WHERE  match_id   = $1
           AND  athlete_id = $2          -- o validador precisa ter feito check-in
           AND  validator_id = $3        -- e apontado para o atleta atual
           AND  ephemeral_token IS NOT NULL
           AND  checkin_time >= NOW() - INTERVAL '5 minutes'`,
        [dto.matchId, dto.validatorId, dto.athleteId],
      );

      let validated = false;

      if (tokenCross.length > 0) {
        // Consenso P2P atingido: marca ambos como validados
        await manager.query(
          `UPDATE checkins_p2p
           SET validated = TRUE
           WHERE match_id = $1
             AND athlete_id IN ($2, $3)`,
          [dto.matchId, dto.athleteId, dto.validatorId],
        );
        validated = true;
        this.logger.log(
          `Consenso P2P validado: ${dto.athleteId} ↔ ${dto.validatorId} | Partida ${dto.matchId}`,
        );
      }

      // 6. Verifica se o quórum foi atingido
      const quorumCheck = await manager.query(
        `SELECT COUNT(*) AS validated_count
         FROM checkins_p2p
         WHERE match_id = $1 AND validated = TRUE`,
        [dto.matchId],
      );

      const validatedCount = parseInt(quorumCheck[0].validated_count, 10);
      const quorumReached  = validatedCount >= min_quorum;

      // 7. Atualiza status da partida se quórum atingido
      if (quorumReached && status === 'checkin') {
        await manager.query(
          `SELECT fn_update_match_quorum($1)`,
          [dto.matchId],
        );
        this.logger.log(`Quórum atingido na partida ${dto.matchId}. Status → ongoing`);
      } else if (status === 'scheduled') {
        // Primeira chegada — muda para fase de check-in
        await manager.query(
          `UPDATE match_scheduling SET status = 'checkin' WHERE id = $1 AND status = 'scheduled'`,
          [dto.matchId],
        );
      }

      return {
        checkInId,
        validated,
        quorumReached,
        message: validated
          ? `Check-in validado por consenso P2P. Quórum: ${validatedCount}/${min_quorum}.`
          : `Check-in registrado. Aguardando confirmação do par (${validatedCount}/${min_quorum}).`,
      };
    });
  }
}
