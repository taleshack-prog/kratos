-- ============================================================
-- KRATOS BASQUETE URBANO
-- Schema: kratos_core
-- Engine: PostgreSQL 14+ com PostGIS 3.2+
-- Versão: 1.0.0 | 01/05/2026
-- ============================================================
-- Pré-requisito (executar como superuser):
--   CREATE DATABASE kratos_core;
--   \c kratos_core
-- ============================================================

-- ── Extensões ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 1. ATHLETES
-- Atletas e Pais/Responsáveis no mesmo domínio.
-- biometric_hash: SHA-256 da imagem biométrica. Nunca a imagem.
-- parent_id: auto-relacionamento — aponta para o responsável
--            quando is_minor = TRUE.
-- Elo é dividido em 3 dimensões independentes (H, C, Z):
--   elo_h = Habilidade técnica (performance em partidas)
--   elo_c = Comportamento / Fair-play (avaliação dos pares)
--   elo_z = Zeladoria (bônus por reportar problemas reais)
-- ============================================================
CREATE TABLE athletes (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             VARCHAR(100) NOT NULL,
    email            VARCHAR(150) UNIQUE NOT NULL,
    phone            VARCHAR(20),
    birth_date       DATE        NOT NULL,
    biometric_hash   TEXT        NOT NULL,          -- hash SHA-256, nunca dado bruto
    position         VARCHAR(5)  CHECK (position IN ('PG','SG','SF','PF','C')),
    is_minor         BOOLEAN     NOT NULL DEFAULT FALSE,
    parent_id        UUID        REFERENCES athletes(id) ON DELETE SET NULL,
    elo_h            INTEGER     NOT NULL DEFAULT 1500,  -- Habilidade
    elo_c            INTEGER     NOT NULL DEFAULT 1500,  -- Comportamento
    elo_z            INTEGER     NOT NULL DEFAULT 1500,  -- Zeladoria
    reputation_score NUMERIC(5,2) NOT NULL DEFAULT 0.00, -- Score 0-100 calculado
    is_captain       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_minor_has_parent
        CHECK (is_minor = FALSE OR parent_id IS NOT NULL),
    CONSTRAINT chk_elo_h_range CHECK (elo_h BETWEEN 0 AND 5000),
    CONSTRAINT chk_elo_c_range CHECK (elo_c BETWEEN 0 AND 5000),
    CONSTRAINT chk_elo_z_range CHECK (elo_z BETWEEN 0 AND 5000),
    CONSTRAINT chk_reputation_range CHECK (reputation_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_athletes_email    ON athletes (email);
CREATE INDEX idx_athletes_parent   ON athletes (parent_id);
CREATE INDEX idx_athletes_captain  ON athletes (is_captain) WHERE is_captain = TRUE;

COMMENT ON TABLE  athletes IS 'Perfis de atletas e responsáveis. Responsáveis apontam para si via parent_id.';
COMMENT ON COLUMN athletes.biometric_hash IS 'SHA-256 da biometria. Dado bruto NUNCA persiste (LGPD Art. 11).';
COMMENT ON COLUMN athletes.elo_h IS 'Elo de Habilidade técnica. Base 1500.';
COMMENT ON COLUMN athletes.elo_c IS 'Elo de Comportamento / Fair-play. Base 1500.';
COMMENT ON COLUMN athletes.elo_z IS 'Elo de Zeladoria. Base 1500. Incrementado por reports válidos.';
COMMENT ON COLUMN athletes.reputation_score IS 'Score 0-100 calculado periodicamente: 40%% assiduidade + 30%% fair-play + 20%% engajamento + 10%% verificação.';

-- ============================================================
-- 2. COURTS
-- Quadras como POLÍGONOS geográficos (área física real).
-- pmpa_asset_id: chave de sincronização com o Backend PMPA.
-- half_court_simultaneous: se TRUE, permite reservas de
--   meia-quadra simultâneas no mesmo slot.
-- ============================================================
CREATE TABLE courts (
    id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    pmpa_asset_id            VARCHAR(50) UNIQUE,              -- ID do ativo na prefeitura
    name                     VARCHAR(100) NOT NULL,
    address                  TEXT,
    geom                     GEOMETRY(POLYGON, 4326) NOT NULL, -- Perímetro real da quadra
    status                   VARCHAR(20) NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active','maintenance','closed')),
    half_court_simultaneous  BOOLEAN     NOT NULL DEFAULT FALSE,
    opening_hour             TIME,
    closing_hour             TIME,
    created_at               TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_opening_closing
        CHECK (opening_hour IS NULL OR closing_hour IS NULL OR opening_hour < closing_hour)
);

CREATE INDEX idx_courts_geom   ON courts USING GIST(geom);
CREATE INDEX idx_courts_status ON courts (status);

COMMENT ON TABLE  courts IS 'Quadras públicas geridas pela PMPA. Sincronizadas via pmpa_asset_id.';
COMMENT ON COLUMN courts.geom IS 'POLYGON WGS-84 do perímetro físico da quadra.';
COMMENT ON COLUMN courts.half_court_simultaneous IS 'Se TRUE, permite 2 reservas de meia-quadra simultâneas no mesmo slot.';

-- ============================================================
-- 3. COURTS_AVAILABILITY
-- Slots de disponibilidade RECORRENTES por dia da semana.
-- A partir desses slots o sistema gera as janelas de agendamento.
-- ============================================================
CREATE TABLE courts_availability (
    id           UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    court_id     UUID      NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    weekday      SMALLINT  NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Dom, 6=Sáb
    slot_start   TIME      NOT NULL,
    duration     INTERVAL  NOT NULL DEFAULT '01:00:00',
    is_recurring BOOLEAN   NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_availability_court_weekday ON courts_availability (court_id, weekday, slot_start);

COMMENT ON COLUMN courts_availability.weekday IS '0=Domingo, 1=Segunda ... 6=Sábado.';

-- ============================================================
-- 4. MATCH_SCHEDULING
-- Partidas agendadas. Cobre 1v1, 3v3 e 5v5.
-- min_quorum: número mínimo de check-ins P2P para confirmar.
-- ============================================================
CREATE TABLE match_scheduling (
    id               UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    court_id         UUID      REFERENCES courts(id) ON DELETE SET NULL,
    availability_id  UUID      REFERENCES courts_availability(id) ON DELETE SET NULL,
    creator_id       UUID      NOT NULL REFERENCES athletes(id) ON DELETE RESTRICT,
    modality         SMALLINT  NOT NULL CHECK (modality IN (1, 2, 3, 5)), -- jogadores por time
    match_type       VARCHAR(20) NOT NULL DEFAULT 'public'
                         CHECK (match_type IN ('public','private','practice')),
    court_half       VARCHAR(10) CHECK (court_half IN ('full','home','away')),
    min_elo          INTEGER   NOT NULL DEFAULT 0,
    min_quorum       SMALLINT  NOT NULL CHECK (min_quorum > 0),
    scheduled_start  TIMESTAMP NOT NULL,
    scheduled_end    TIMESTAMP NOT NULL,
    status           VARCHAR(25) NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled','checkin','ongoing',
                                           'finished','cancelled','quorum_insufficient')),
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_schedule_times CHECK (scheduled_start < scheduled_end)
);

CREATE INDEX idx_match_court_time  ON match_scheduling (court_id, scheduled_start);
CREATE INDEX idx_match_creator     ON match_scheduling (creator_id);
CREATE INDEX idx_match_status      ON match_scheduling (status);

COMMENT ON COLUMN match_scheduling.modality IS '1=1v1, 2=2v2, 3=3v3, 5=5v5.';
COMMENT ON COLUMN match_scheduling.court_half IS 'full=quadra inteira, home/away=meia-quadra.';
COMMENT ON COLUMN match_scheduling.min_quorum IS 'Check-ins P2P necessários para mudar status para ongoing.';

-- ============================================================
-- 5. MATCH_ROSTER
-- Vínculo atleta ↔ partida. Registra o time e o check-in.
-- ============================================================
CREATE TABLE match_roster (
    id            UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id      UUID      NOT NULL REFERENCES match_scheduling(id) ON DELETE CASCADE,
    athlete_id    UUID      NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    team_color    VARCHAR(10) CHECK (team_color IN ('home','away')),
    joined_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (match_id, athlete_id)
);

CREATE INDEX idx_roster_match   ON match_roster (match_id);
CREATE INDEX idx_roster_athlete ON match_roster (athlete_id);

-- ============================================================
-- 6. CHECKINS_P2P
-- Validação de presença física via Bluetooth LE + GPS.
-- Consenso: backend valida quando ambos os dispositivos
--   trocam tokens e a geolocalização cruza com o polígono
--   da quadra (ST_Within).
-- ============================================================
CREATE TABLE checkins_p2p (
    id              UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id        UUID      NOT NULL REFERENCES match_scheduling(id) ON DELETE CASCADE,
    athlete_id      UUID      NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    validator_id    UUID      REFERENCES athletes(id) ON DELETE SET NULL, -- quem validou
    bluetooth_rssi  SMALLINT,                              -- força do sinal BLE (dBm)
    gps_point       GEOMETRY(POINT, 4326),                -- posição no momento do check-in
    ephemeral_token TEXT,                                  -- token efêmero trocado entre dispositivos
    validated       BOOLEAN   NOT NULL DEFAULT FALSE,
    checkin_time    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (match_id, athlete_id)
);

CREATE INDEX idx_checkins_gps          ON checkins_p2p USING GIST(gps_point);
CREATE INDEX idx_checkins_match_athlete ON checkins_p2p (match_id, athlete_id);

COMMENT ON COLUMN checkins_p2p.bluetooth_rssi IS 'RSSI do sinal Bluetooth LE. Valores abaixo de -80dBm são rejeitados.';
COMMENT ON COLUMN checkins_p2p.ephemeral_token IS 'Token de sessão único trocado P2P. Descartado após validação.';

-- ============================================================
-- 7. REPUTATION_LOGS
-- Log imutável de cada evento que afeta o reputation_score.
-- Auditoria completa de por que um atleta virou Capitão.
-- ============================================================
CREATE TABLE reputation_logs (
    id          UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    athlete_id  UUID      NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    event_type  VARCHAR(30) NOT NULL
                    CHECK (event_type IN (
                        'match_attended',   -- presença confirmada (+)
                        'match_no_show',    -- faltou sem cancelar (-)
                        'fair_play_up',     -- avaliação positiva dos pares (+)
                        'fair_play_down',   -- avaliação negativa (-)
                        'zeladoria_report', -- report de problema validado (+)
                        'new_member',       -- convidou e validou novo membro (+)
                        'captain_granted',  -- tornou-se capitão
                        'captain_revoked'   -- perdeu o status de capitão (-)
                    )),
    delta       NUMERIC(5,2) NOT NULL,   -- variação no reputation_score
    match_id    UUID REFERENCES match_scheduling(id) ON DELETE SET NULL,
    note        TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reputlog_athlete ON reputation_logs (athlete_id, created_at DESC);

-- ============================================================
-- 8. PARENT_AUTHORIZATIONS
-- Pais/Responsáveis autorizam partidas de menores.
-- Somente o parent_id vinculado ao atleta pode autorizar.
-- ============================================================
CREATE TABLE parent_authorizations (
    id          UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id    UUID      NOT NULL REFERENCES match_scheduling(id) ON DELETE CASCADE,
    minor_id    UUID      NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    parent_id   UUID      NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','denied')),
    notified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,

    UNIQUE (match_id, minor_id)
);

CREATE INDEX idx_parentauth_minor  ON parent_authorizations (minor_id);
CREATE INDEX idx_parentauth_parent ON parent_authorizations (parent_id, status);

COMMENT ON TABLE parent_authorizations IS 'Aprovação obrigatória de responsável para atletas com is_minor=TRUE.';

-- ============================================================
-- 9. ZELADORIA_REPORTS (lado Kratos)
-- Reports de problemas físicos enviados pelos atletas.
-- Dados anonimizados são sincronizados para pmpa_govtech.
-- ============================================================
CREATE TABLE zeladoria_reports (
    id           UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    court_id     UUID      NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    reporter_id  UUID      REFERENCES athletes(id) ON DELETE SET NULL, -- anonimizado no PMPA
    issue_type   VARCHAR(50) NOT NULL
                     CHECK (issue_type IN (
                         'broken_hoop','lighting','floor','cleanliness',
                         'security','vandalism','other'
                     )),
    description  TEXT,
    photos       JSONB,    -- [{url: '...', thumbnail: '...'}]
    gps_point    GEOMETRY(POINT, 4326),
    status       VARCHAR(20) NOT NULL DEFAULT 'reported'
                     CHECK (status IN ('reported','in_progress','resolved','closed')),
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at  TIMESTAMP,

    CONSTRAINT chk_resolved_after_created
        CHECK (resolved_at IS NULL OR resolved_at > created_at)
);

CREATE INDEX idx_zeladoria_court  ON zeladoria_reports (court_id);
CREATE INDEX idx_zeladoria_status ON zeladoria_reports (status);

-- ============================================================
-- 10. MATCH_TRANSACTIONS (Micro-Caução)
-- Sistema de caução simbólica anti-no-show.
-- O valor é retido e redistribuído automaticamente via webhook.
-- ============================================================
CREATE TABLE match_transactions (
    id              UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id        UUID      NOT NULL REFERENCES match_scheduling(id) ON DELETE CASCADE,
    athlete_id      UUID      NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    amount_brl      NUMERIC(6,2) NOT NULL DEFAULT 2.00, -- R$ 2,00 padrão
    status          VARCHAR(20) NOT NULL DEFAULT 'held'
                        CHECK (status IN ('held','refunded','forfeited','donated')),
    payment_method  VARCHAR(20) CHECK (payment_method IN ('pix','credit','marketplace_credit')),
    held_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settled_at      TIMESTAMP,

    UNIQUE (match_id, athlete_id)
);

CREATE INDEX idx_transactions_athlete ON match_transactions (athlete_id, status);

COMMENT ON TABLE match_transactions IS 'Micro-caução: R$2 retidos na confirmação, devolvidos como crédito se o atleta comparecer.';

-- ============================================================
-- TRIGGER: updated_at automático em athletes
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_athletes_updated_at
    BEFORE UPDATE ON athletes
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- FUNCTION: Verifica conflito de agendamento
-- Retorna TRUE se houver sobreposição de horário na quadra.
-- Respeita a regra de meia-quadra:
--   - FULL bloqueia qualquer sobreposição
--   - HALF só conflita com FULL ou se ambas as meias estão ocupadas
-- ============================================================
CREATE OR REPLACE FUNCTION fn_check_schedule_conflict(
    p_court_id      UUID,
    p_start         TIMESTAMP,
    p_end           TIMESTAMP,
    p_court_half    VARCHAR(10)  -- 'full', 'home', 'away'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM match_scheduling
    WHERE court_id = p_court_id
      AND status IN ('scheduled','checkin','ongoing')
      AND p_start < scheduled_end
      AND scheduled_start < p_end
      AND (
          p_court_half = 'full'          -- proposta FULL conflita com qualquer reserva
          OR court_half = 'full'         -- existente FULL conflita com proposta HALF
          OR court_half = p_court_half   -- mesma meia-quadra ocupada
      );

    RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_check_schedule_conflict IS
'Retorna TRUE se houver conflito. Chamar antes de INSERT em match_scheduling.';

-- ============================================================
-- FUNCTION: Atualiza status da partida baseado no quórum P2P
-- Chamada pelo Backend Kratos após cada check-in recebido.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_update_match_quorum(p_match_id UUID)
RETURNS VOID AS $$
DECLARE
    v_quorum    SMALLINT;
    v_checkins  INTEGER;
BEGIN
    SELECT min_quorum INTO v_quorum
    FROM match_scheduling
    WHERE id = p_match_id;

    SELECT COUNT(*) INTO v_checkins
    FROM checkins_p2p
    WHERE match_id = p_match_id
      AND validated = TRUE
      AND checkin_time >= NOW() - INTERVAL '1 hour';

    IF v_checkins >= v_quorum THEN
        UPDATE match_scheduling
        SET status = 'ongoing'
        WHERE id = p_match_id AND status = 'checkin';
    ELSE
        UPDATE match_scheduling
        SET status = 'quorum_insufficient'
        WHERE id = p_match_id AND status = 'checkin';
    END IF;
END;
$$ LANGUAGE plpgsql;
