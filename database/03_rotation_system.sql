-- ============================================================
-- KRATOS BASQUETE URBANO
-- Schema: Sistema de Revezamento Dinâmico
-- Adicionar ao banco: kratos_core
-- Versão: 1.1.0 | 01/05/2026
-- ============================================================
-- Execute após 01_kratos_core.sql:
--   \c kratos_core
--   \i 03_rotation_system.sql
-- ============================================================

-- ============================================================
-- ENUM: Tipos de configuração de revezamento
-- ============================================================
CREATE TYPE rotation_mode AS ENUM (
    'none',            -- nenhum revezamento (quorum exato)
    'queue_single',    -- 1 ou mais na fila, perdedor sai, próximo entra
    'bench_per_team',  -- 1 reserva por time, troca simultânea por consenso
    'three_teams',     -- 3 times, perdedor sai inteiro, próximo entra
    'winner_stays'     -- vencedor fica, perdedor reveza (5v5 incompleto)
);

-- ============================================================
-- ENUM: Método de formação de times
-- ============================================================
CREATE TYPE team_formation_method AS ENUM (
    'captain_draft',   -- Capitães com ranking escolhem (snake draft)
    'consensus'        -- Sem ranking suficiente: votação no app
);

-- ============================================================
-- 1. MATCH_ROTATION_CONFIG
-- Configuração calculada no momento em que o roster fecha.
-- Uma linha por partida — define como o revezamento vai funcionar.
-- ============================================================
CREATE TABLE match_rotation_config (
    id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id         UUID          NOT NULL UNIQUE REFERENCES match_scheduling(id) ON DELETE CASCADE,

    -- Configuração de revezamento
    rotation_mode    rotation_mode NOT NULL DEFAULT 'none',
    total_players    SMALLINT      NOT NULL,  -- total de atletas no roster
    players_per_team SMALLINT      NOT NULL,  -- jogadores por time (= modality)
    active_teams     SMALLINT      NOT NULL DEFAULT 2, -- 2 ou 3
    bench_count      SMALLINT      NOT NULL DEFAULT 0, -- total na fila/banco

    -- Formação de times
    formation_method team_formation_method NOT NULL DEFAULT 'consensus',
    captain_a_id     UUID REFERENCES athletes(id) ON DELETE SET NULL,
    captain_b_id     UUID REFERENCES athletes(id) ON DELETE SET NULL,
    captain_c_id     UUID REFERENCES athletes(id) ON DELETE SET NULL, -- só em three_teams

    -- Controle de timer (5v5 winner_stays e three_teams)
    game_duration_minutes SMALLINT DEFAULT NULL, -- NULL = sem timer fixo
    requires_timer        BOOLEAN  NOT NULL DEFAULT FALSE,

    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE match_rotation_config IS
'Configuração de revezamento calculada quando o roster fecha. Imutável após criação.';

COMMENT ON COLUMN match_rotation_config.rotation_mode IS
'none=sem revezamento | queue_single=fila simples | bench_per_team=1 reserva/time |
 three_teams=3 times completos | winner_stays=vencedor fica (5v5 parcial)';

-- ============================================================
-- 2. MATCH_TEAMS
-- Times dentro de uma partida.
-- Suporta 2 ou 3 times (three_teams).
-- ============================================================
CREATE TABLE match_teams (
    id         UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id   UUID      NOT NULL REFERENCES match_scheduling(id) ON DELETE CASCADE,
    team_label VARCHAR(10) NOT NULL CHECK (team_label IN ('A', 'B', 'C')),
    captain_id UUID      REFERENCES athletes(id) ON DELETE SET NULL,
    status     VARCHAR(20) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'waiting', 'eliminated')),

    UNIQUE (match_id, team_label)
);

CREATE INDEX idx_teams_match ON match_teams (match_id);

-- ============================================================
-- 3. MATCH_TEAM_MEMBERS
-- Vínculo atleta ↔ time (dentro da partida).
-- role: 'player' = em quadra | 'bench' = reserva/fila
-- ============================================================
CREATE TABLE match_team_members (
    id         UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id   UUID      NOT NULL REFERENCES match_scheduling(id) ON DELETE CASCADE,
    team_id    UUID      NOT NULL REFERENCES match_teams(id) ON DELETE CASCADE,
    athlete_id UUID      NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    role       VARCHAR(10) NOT NULL DEFAULT 'player'
                   CHECK (role IN ('player', 'bench')),
    queue_pos  SMALLINT  DEFAULT NULL, -- posição na fila (bench_per_team e queue_single)
    joined_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (match_id, athlete_id) -- atleta só pode estar em 1 time por partida
);

CREATE INDEX idx_members_match_team ON match_team_members (match_id, team_id);
CREATE INDEX idx_members_athlete    ON match_team_members (athlete_id);

-- ============================================================
-- 4. MATCH_ROTATION_EVENTS
-- Log imutável de cada evento de revezamento.
-- Auditoria completa: quem saiu, quem entrou, quando, como.
-- ============================================================
CREATE TABLE match_rotation_events (
    id            UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id      UUID      NOT NULL REFERENCES match_scheduling(id) ON DELETE CASCADE,
    event_type    VARCHAR(30) NOT NULL
                      CHECK (event_type IN (
                          'team_formed',        -- time foi formado (captain_draft ou consensus)
                          'game_started',       -- rodada iniciou
                          'game_ended',         -- rodada terminou (com resultado)
                          'rotation_triggered', -- revezamento foi acionado
                          'bench_swap',         -- troca simultânea bench_per_team
                          'team_eliminated',    -- time saiu (three_teams)
                          'team_entered',       -- time entrou (three_teams)
                          'timer_expired'       -- timer de 10min expirou (5v5)
                      )),
    winning_team  VARCHAR(10) CHECK (winning_team IN ('A', 'B', 'C', 'draw')),
    losing_team   VARCHAR(10) CHECK (losing_team  IN ('A', 'B', 'C')),
    -- Atletas que entraram/saíram neste evento (JSONB para flexibilidade)
    athletes_out  JSONB DEFAULT '[]', -- [{athlete_id, team_label}]
    athletes_in   JSONB DEFAULT '[]', -- [{athlete_id, team_label}]
    initiated_by  UUID  REFERENCES athletes(id) ON DELETE SET NULL, -- quem acionou o consenso
    game_round    SMALLINT NOT NULL DEFAULT 1, -- número da rodada na partida
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rotation_events_match ON match_rotation_events (match_id, created_at DESC);

-- ============================================================
-- 5. BENCH_CONSENSUS
-- Controle de consenso para troca de reservas (bench_per_team).
-- Ambos os times precisam confirmar antes da troca acontecer.
-- Também usado para consenso de formação de times.
-- ============================================================
CREATE TABLE bench_consensus (
    id           UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id     UUID      NOT NULL REFERENCES match_scheduling(id) ON DELETE CASCADE,
    consensus_type VARCHAR(20) NOT NULL
                     CHECK (consensus_type IN (
                         'bench_swap',      -- troca de reservas
                         'team_formation',  -- formação inicial dos times
                         'draft_pick'       -- escolha de capitão no snake draft
                     )),
    game_round   SMALLINT  NOT NULL DEFAULT 1,
    team_a_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    team_b_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    team_c_confirmed BOOLEAN NOT NULL DEFAULT FALSE, -- three_teams
    confirmed_at TIMESTAMP,  -- preenchido quando todos confirmam
    expires_at   TIMESTAMP  NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes'),
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_consensus_match ON bench_consensus (match_id, status);

-- ============================================================
-- 6. CAPTAIN_DRAFT_PICKS
-- Registro do snake draft quando formation_method = 'captain_draft'.
-- Ordem: A escolhe → B escolhe → B escolhe → A escolhe → ...
-- ============================================================
CREATE TABLE captain_draft_picks (
    id           UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id     UUID      NOT NULL REFERENCES match_scheduling(id) ON DELETE CASCADE,
    round        SMALLINT  NOT NULL,       -- rodada do draft (1, 2, 3...)
    pick_number  SMALLINT  NOT NULL,       -- número global do pick
    captain_id   UUID      NOT NULL REFERENCES athletes(id),
    team_label   VARCHAR(10) NOT NULL CHECK (team_label IN ('A', 'B', 'C')),
    picked_athlete_id UUID NOT NULL REFERENCES athletes(id),
    picked_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (match_id, pick_number)
);

-- ============================================================
-- FUNCTION: Calcula rotation_mode a partir do roster
-- Chamada automaticamente quando o roster fecha.
--
-- Regras:
--   1v1: 3+     → queue_single
--   2v2: 5+     → queue_single
--   3v3: 7      → queue_single
--         8     → bench_per_team
--         9+    → three_teams
--   5v5: 11-15  → winner_stays
--         16+   → three_teams (timer 10min)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_calculate_rotation_mode(
    p_modality    SMALLINT,  -- jogadores por time (1,2,3,5)
    p_total       SMALLINT   -- total de atletas no roster
)
RETURNS TABLE (
    rotation_mode       rotation_mode,
    active_teams        SMALLINT,
    bench_count         SMALLINT,
    requires_timer      BOOLEAN,
    game_duration_min   SMALLINT
) AS $$
DECLARE
    v_min_players SMALLINT := p_modality * 2; -- mínimo para 2 times
BEGIN
    -- Sem revezamento: quórum exato
    IF p_total <= v_min_players THEN
        RETURN QUERY SELECT
            'none'::rotation_mode,
            2::SMALLINT,
            0::SMALLINT,
            FALSE,
            NULL::SMALLINT;
        RETURN;
    END IF;

    -- 1v1 (modality=1): 3+ → fila simples
    IF p_modality = 1 THEN
        RETURN QUERY SELECT
            'queue_single'::rotation_mode,
            2::SMALLINT,
            (p_total - 2)::SMALLINT,
            FALSE,
            NULL::SMALLINT;
        RETURN;
    END IF;

    -- 2v2 (modality=2): 5+ → fila simples
    IF p_modality = 2 THEN
        RETURN QUERY SELECT
            'queue_single'::rotation_mode,
            2::SMALLINT,
            (p_total - 4)::SMALLINT,
            FALSE,
            NULL::SMALLINT;
        RETURN;
    END IF;

    -- 3v3 (modality=3)
    IF p_modality = 3 THEN
        IF p_total = 7 THEN
            RETURN QUERY SELECT
                'queue_single'::rotation_mode,
                2::SMALLINT,
                1::SMALLINT,
                FALSE, NULL::SMALLINT;
        ELSIF p_total = 8 THEN
            RETURN QUERY SELECT
                'bench_per_team'::rotation_mode,
                2::SMALLINT,
                2::SMALLINT,   -- 1 banco por time
                FALSE, NULL::SMALLINT;
        ELSE -- 9+: 3 times completos
            RETURN QUERY SELECT
                'three_teams'::rotation_mode,
                3::SMALLINT,
                3::SMALLINT,   -- time C inteiro na fila
                FALSE, NULL::SMALLINT;
        END IF;
        RETURN;
    END IF;

    -- 5v5 (modality=5)
    IF p_modality = 5 THEN
        IF p_total BETWEEN 11 AND 15 THEN
            RETURN QUERY SELECT
                'winner_stays'::rotation_mode,
                2::SMALLINT,
                (p_total - 10)::SMALLINT,
                FALSE, NULL::SMALLINT;
        ELSE -- 16+: 3 times, timer 10min
            RETURN QUERY SELECT
                'three_teams'::rotation_mode,
                3::SMALLINT,
                (p_total - 10)::SMALLINT,  -- time C na fila
                TRUE,
                10::SMALLINT;  -- 10 minutos por rodada
        END IF;
        RETURN;
    END IF;

    -- Fallback
    RETURN QUERY SELECT
        'none'::rotation_mode, 2::SMALLINT, 0::SMALLINT, FALSE, NULL::SMALLINT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION fn_calculate_rotation_mode IS
'Calcula o modo de revezamento baseado na modalidade e total de jogadores no roster.
 Chamada quando o roster fecha (quórum atingido).';

-- ============================================================
-- FUNCTION: Determina método de formação de times
-- captain_draft: se os 2+ melhores Elos têm >= 5 partidas validadas
-- consensus: caso contrário
-- ============================================================
CREATE OR REPLACE FUNCTION fn_team_formation_method(
    p_match_id   UUID,
    p_active_teams SMALLINT DEFAULT 2
)
RETURNS team_formation_method AS $$
DECLARE
    v_captains_ready INTEGER;
BEGIN
    -- Conta atletas no roster com >= 5 partidas validadas
    -- (proxy para "ranking suficiente")
    SELECT COUNT(*) INTO v_captains_ready
    FROM match_roster mr
    JOIN athletes a ON a.id = mr.athlete_id
    WHERE mr.match_id = p_match_id
      AND (
          SELECT COUNT(*)
          FROM checkins_p2p cp
          WHERE cp.athlete_id = a.id AND cp.validated = TRUE
      ) >= 5
    ORDER BY (a.elo_h * 0.5 + a.elo_c * 0.3 + a.elo_z * 0.2) DESC
    LIMIT p_active_teams;  -- precisa de 2 (ou 3) capitães prontos

    IF v_captains_ready >= p_active_teams THEN
        RETURN 'captain_draft';
    ELSE
        RETURN 'consensus';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Inicializa rotation_config quando roster fecha
-- Chamada pelo backend após fn_update_match_quorum confirmar quórum
-- ============================================================
CREATE OR REPLACE FUNCTION fn_initialize_rotation(p_match_id UUID)
RETURNS VOID AS $$
DECLARE
    v_modality    SMALLINT;
    v_total       SMALLINT;
    v_rot         RECORD;
    v_method      team_formation_method;
    v_cap_a_id    UUID;
    v_cap_b_id    UUID;
    v_cap_c_id    UUID;
BEGIN
    -- Busca modalidade e total de atletas confirmados
    SELECT
        ms.modality,
        COUNT(mr.athlete_id)::SMALLINT
    INTO v_modality, v_total
    FROM match_scheduling ms
    JOIN match_roster mr ON mr.match_id = ms.id
    WHERE ms.id = p_match_id
    GROUP BY ms.modality;

    -- Calcula o modo de revezamento
    SELECT * INTO v_rot
    FROM fn_calculate_rotation_mode(v_modality, v_total);

    -- Determina método de formação
    v_method := fn_team_formation_method(p_match_id, v_rot.active_teams);

    -- Se captain_draft, identifica os capitães (top Elo composto)
    IF v_method = 'captain_draft' THEN
        SELECT athlete_id INTO v_cap_a_id
        FROM match_roster mr
        JOIN athletes a ON a.id = mr.athlete_id
        WHERE mr.match_id = p_match_id
        ORDER BY (a.elo_h * 0.5 + a.elo_c * 0.3 + a.elo_z * 0.2) DESC
        LIMIT 1;

        SELECT athlete_id INTO v_cap_b_id
        FROM match_roster mr
        JOIN athletes a ON a.id = mr.athlete_id
        WHERE mr.match_id = p_match_id
          AND mr.athlete_id != v_cap_a_id
        ORDER BY (a.elo_h * 0.5 + a.elo_c * 0.3 + a.elo_z * 0.2) DESC
        LIMIT 1;

        IF v_rot.active_teams = 3 THEN
            SELECT athlete_id INTO v_cap_c_id
            FROM match_roster mr
            JOIN athletes a ON a.id = mr.athlete_id
            WHERE mr.match_id = p_match_id
              AND mr.athlete_id NOT IN (v_cap_a_id, v_cap_b_id)
            ORDER BY (a.elo_h * 0.5 + a.elo_c * 0.3 + a.elo_z * 0.2) DESC
            LIMIT 1;
        END IF;
    END IF;

    -- Persiste a configuração
    INSERT INTO match_rotation_config (
        match_id, rotation_mode, total_players, players_per_team,
        active_teams, bench_count, formation_method,
        captain_a_id, captain_b_id, captain_c_id,
        requires_timer, game_duration_minutes
    ) VALUES (
        p_match_id,
        v_rot.rotation_mode,
        v_total,
        v_modality,
        v_rot.active_teams,
        v_rot.bench_count,
        v_method,
        v_cap_a_id, v_cap_b_id, v_cap_c_id,
        v_rot.requires_timer,
        v_rot.game_duration_min
    )
    ON CONFLICT (match_id) DO NOTHING;

    -- Cria os times vazios
    INSERT INTO match_teams (match_id, team_label, captain_id, status)
    VALUES
        (p_match_id, 'A', v_cap_a_id, 'active'),
        (p_match_id, 'B', v_cap_b_id, 'active');

    IF v_rot.active_teams = 3 THEN
        INSERT INTO match_teams (match_id, team_label, captain_id, status)
        VALUES (p_match_id, 'C', v_cap_c_id, 'waiting');
    END IF;

    -- Abre consenso de formação de times
    INSERT INTO bench_consensus (
        match_id, consensus_type, game_round,
        team_a_confirmed, team_b_confirmed, team_c_confirmed
    ) VALUES (
        p_match_id, 'team_formation', 0,
        FALSE, FALSE,
        CASE WHEN v_rot.active_teams = 3 THEN FALSE ELSE TRUE END
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_initialize_rotation IS
'Inicializa toda a configuração de revezamento quando o quórum P2P é atingido.
 Cria times, define capitães e abre o consenso de formação.';
