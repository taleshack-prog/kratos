-- ============================================================
-- KRATOS BASQUETE URBANO
-- Schema: pmpa_govtech
-- Engine: PostgreSQL 14+ com PostGIS 3.2+
-- Versão: 1.0.0 | 01/05/2026
-- ============================================================
-- Pré-requisito (executar como superuser):
--   CREATE DATABASE pmpa_govtech;
--   \c pmpa_govtech
-- ============================================================
-- IMPORTANTE: Este banco NÃO tem FKs para kratos_core.
-- A sincronização é feita via API / webhooks.
-- Dados de atletas chegam ANONIMIZADOS (sem nome, email, CPF).
-- ============================================================

-- ── Extensões ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 1. PRACAS
-- Praças públicas cadastradas pela Prefeitura.
-- Cada praça pode ter N quadras.
-- ============================================================
CREATE TABLE pracas (
    id          UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    district    VARCHAR(80),             -- bairro
    city        VARCHAR(80) NOT NULL DEFAULT 'Porto Alegre',
    geom        GEOMETRY(POINT, 4326),   -- centróide da praça
    active      BOOLEAN   NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pracas_geom   ON pracas USING GIST(geom);
CREATE INDEX idx_pracas_active ON pracas (active);

-- ── Seed: 5 praças estratégicas do beta ─────────────────────
INSERT INTO pracas (name, district, geom) VALUES
    ('Praça da Encol',         'Bela Vista',
        ST_SetSRID(ST_MakePoint(-51.1979, -30.0412), 4326)),
    ('Parque Marinha do Brasil','Praia de Belas',
        ST_SetSRID(ST_MakePoint(-51.2261, -30.0480), 4326)),
    ('Parcão (Moinhos de Vento)','Moinhos de Vento',
        ST_SetSRID(ST_MakePoint(-51.1940, -30.0300), 4326)),
    ('Praça Germânia',          'Passo d''Areia',
        ST_SetSRID(ST_MakePoint(-51.1580, -30.0170), 4326)),
    ('Parque Redenção',         'Farroupilha',
        ST_SetSRID(ST_MakePoint(-51.2125, -30.0366), 4326));

-- ============================================================
-- 2. QUADRAS_PMPA
-- Quadras vinculadas às praças. Espelham os courts do kratos_core
-- via kratos_court_id (sem FK real — sincronização via API).
-- ============================================================
CREATE TABLE quadras_pmpa (
    id              UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    praca_id        UUID      NOT NULL REFERENCES pracas(id) ON DELETE CASCADE,
    kratos_court_id UUID      UNIQUE,        -- espelho do courts.id no kratos_core
    name            VARCHAR(100) NOT NULL,
    geom            GEOMETRY(POLYGON, 4326),
    has_lighting    BOOLEAN   NOT NULL DEFAULT FALSE,
    surface_type    VARCHAR(30) CHECK (surface_type IN ('asphalt','concrete','wood','synthetic')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','maintenance','closed')),
    last_inspected  DATE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quadras_praca  ON quadras_pmpa (praca_id);
CREATE INDEX idx_quadras_geom   ON quadras_pmpa USING GIST(geom);
CREATE INDEX idx_quadras_status ON quadras_pmpa (status);

-- ============================================================
-- 3. COURT_VITALITY
-- Métricas de vitalidade por slot de tempo.
-- Alimentada por dados ANONIMIZADOS vindos do Backend Kratos.
-- ============================================================
CREATE TABLE court_vitality (
    id                    UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    court_id              UUID      NOT NULL,  -- kratos_court_id (sem FK cross-DB)
    praca_id              UUID      REFERENCES pracas(id) ON DELETE SET NULL,
    measurement_time      TIMESTAMP NOT NULL,
    scheduled_occupation  INTEGER   NOT NULL DEFAULT 0,  -- jogadores agendados
    real_occupation       INTEGER   NOT NULL DEFAULT 0,  -- check-ins P2P confirmados
    density               NUMERIC(5,2),                  -- jogadores/m²
    peak_hour             TIME,
    unique_users_count    INTEGER   NOT NULL DEFAULT 0,

    CONSTRAINT chk_real_le_scheduled
        CHECK (real_occupation <= scheduled_occupation * 2) -- margem para práticas livres
);

CREATE INDEX idx_vitality_court_time ON court_vitality (court_id, measurement_time DESC);

COMMENT ON TABLE court_vitality IS 'Série temporal de ocupação. Base para heatmap e decisões de investimento da PMPA.';

-- ============================================================
-- 4. ZELADORIA_REPORTS_PMPA
-- Cópia anonimizada dos reports do kratos_core.
-- reporter_id = UUID anonimizado (nunca o atleta real).
-- ============================================================
CREATE TABLE zeladoria_reports_pmpa (
    id                  UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    kratos_report_id    UUID      UNIQUE NOT NULL, -- ID original do kratos_core
    court_id            UUID      NOT NULL,
    praca_id            UUID      REFERENCES pracas(id) ON DELETE SET NULL,
    issue_type          VARCHAR(50) NOT NULL,
    gps_point           GEOMETRY(POINT, 4326),
    photos              JSONB,
    status              VARCHAR(20) NOT NULL DEFAULT 'reported'
                            CHECK (status IN ('reported','in_progress','resolved','closed')),
    reported_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    service_order_id    VARCHAR(50),   -- OS do sistema municipal (ex: SMSURB)
    resolved_at         TIMESTAMP,
    resolution_notes    TEXT
);

CREATE INDEX idx_zelpmpa_court   ON zeladoria_reports_pmpa (court_id);
CREATE INDEX idx_zelpmpa_status  ON zeladoria_reports_pmpa (status);
CREATE INDEX idx_zelpmpa_praca   ON zeladoria_reports_pmpa (praca_id);

-- ============================================================
-- 5. AUDIT_LOGS
-- Registro imutável de alterações em ativos públicos.
-- Nenhuma linha pode ser deletada ou alterada (append-only).
-- ============================================================
CREATE TABLE audit_logs (
    id           UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type  VARCHAR(40) NOT NULL
                     CHECK (entity_type IN (
                         'quadra_pmpa','zeladoria_report','court_vitality','praca'
                     )),
    entity_id    UUID      NOT NULL,
    action       VARCHAR(20) NOT NULL CHECK (action IN ('created','updated','status_changed','deleted')),
    old_value    JSONB,
    new_value    JSONB,
    operator_id  VARCHAR(80), -- ID do agente municipal (externo ao Kratos)
    source       VARCHAR(20) NOT NULL DEFAULT 'pmpa_backend'
                     CHECK (source IN ('pmpa_backend','kratos_webhook','manual')),
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_time   ON audit_logs (created_at DESC);

COMMENT ON TABLE audit_logs IS 'Append-only. Nenhum UPDATE ou DELETE permitido nesta tabela.';

-- ── Proteção: negar UPDATE e DELETE em audit_logs ───────────
CREATE OR REPLACE FUNCTION fn_deny_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs é imutável. Operação % negada.', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deny_audit_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_deny_audit_mutation();

CREATE TRIGGER trg_deny_audit_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_deny_audit_mutation();

-- ============================================================
-- 6. VIEW: DASHBOARD_PMPA
-- View materializada para o dashboard do Secretário.
-- Recalcular com: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_pmpa;
-- ============================================================
CREATE MATERIALIZED VIEW mv_dashboard_pmpa AS
WITH periodo AS (
    SELECT
        DATE_TRUNC('day', NOW()) - INTERVAL '30 days' AS data_inicio,
        DATE_TRUNC('day', NOW())                        AS data_fim
),
ocupacao AS (
    SELECT
        cv.court_id,
        cv.praca_id,
        SUM(cv.real_occupation)       AS total_real,
        SUM(cv.scheduled_occupation)  AS total_agendado,
        MAX(cv.density)               AS max_density,
        AVG(cv.unique_users_count)    AS media_usuarios_dia
    FROM court_vitality cv, periodo p
    WHERE cv.measurement_time BETWEEN p.data_inicio AND p.data_fim
    GROUP BY cv.court_id, cv.praca_id
),
zeladoria AS (
    SELECT
        praca_id,
        COUNT(*)                                            AS total_reports,
        COUNT(*) FILTER (WHERE status = 'resolved')         AS reports_resolvidos,
        AVG(EXTRACT(EPOCH FROM (resolved_at - reported_at)) / 3600)
            FILTER (WHERE resolved_at IS NOT NULL)          AS media_horas_resolucao
    FROM zeladoria_reports_pmpa
    GROUP BY praca_id
)
SELECT
    pr.id                                              AS praca_id,
    pr.name                                            AS praca,
    pr.district,
    COALESCE(o.total_real, 0)                          AS jogadores_reais_30d,
    COALESCE(o.total_agendado, 0)                      AS jogadores_agendados_30d,
    CASE
        WHEN COALESCE(o.total_agendado, 0) = 0 THEN 0
        ELSE ROUND(o.total_real::NUMERIC / o.total_agendado * 100, 2)
    END                                                AS taxa_ocupacao_real_pct,
    COALESCE(o.max_density, 0)                         AS densidade_maxima,
    COALESCE(o.media_usuarios_dia, 0)                  AS media_usuarios_dia,
    COALESCE(z.total_reports, 0)                       AS total_reports_zeladoria,
    COALESCE(z.reports_resolvidos, 0)                  AS reports_resolvidos,
    COALESCE(z.media_horas_resolucao, 0)               AS media_horas_resolucao,
    NOW()                                              AS gerado_em
FROM pracas pr
LEFT JOIN ocupacao o ON o.praca_id = pr.id
LEFT JOIN zeladoria z ON z.praca_id = pr.id
WHERE pr.active = TRUE
ORDER BY taxa_ocupacao_real_pct DESC;

CREATE UNIQUE INDEX idx_mv_dashboard_praca ON mv_dashboard_pmpa (praca_id);

COMMENT ON MATERIALIZED VIEW mv_dashboard_pmpa IS
'KPIs do Secretário: Taxa de Ocupação Real, Índice de Zeladoria (IZ), Densidade. REFRESH a cada hora.';
