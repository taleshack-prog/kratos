// src/app.ts — Backend PMPA (Node.js / Express / TypeScript)
// ============================================================
// Governança Urbana — Kratos Basquete Urbano
//
// Módulos:
//   /api/courts     — CRUD de quadras (admin da Prefeitura)
//   /api/analytics  — Vitalidade urbana e heatmap
//   /api/zeladoria  — Sincronização de reports e ordens de serviço
//   /api/audit      — Logs imutáveis de ativos públicos
// ============================================================

import express, { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

const app = express();
app.use(express.json());

// ── Conexão ao banco pmpa_govtech ────────────────────────────
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

// ── Middleware de auth interna Kratos → PMPA ─────────────────
function requireKratosSecret(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers['x-kratos-secret'];
  if (secret !== process.env.KRATOS_INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Acesso não autorizado.' });
  }
  next();
}

// ============================================================
// MÓDULO 1: Gestão de Quadras (CRUD — admin PMPA)
// ============================================================

/** GET /api/courts — Lista todas as quadras com status */
app.get('/api/courts', async (req: Request, res: Response) => {
  try {
    const { rows } = await db.query(
      `SELECT
          q.id, q.name, q.status, q.has_lighting, q.surface_type,
          q.last_inspected, p.name AS praca, p.district
       FROM quadras_pmpa q
       JOIN pracas p ON p.id = q.praca_id
       ORDER BY p.name, q.name`,
    );
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/courts — Cadastra nova quadra */
app.post('/api/courts', async (req: Request, res: Response) => {
  const { praca_id, name, has_lighting, surface_type, geom_wkt } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO quadras_pmpa (praca_id, name, has_lighting, surface_type, geom)
       VALUES ($1, $2, $3, $4, ST_GeomFromText($5, 4326))
       RETURNING id, name`,
      [praca_id, name, has_lighting ?? false, surface_type, geom_wkt],
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, new_value, source)
       VALUES ('quadra_pmpa', $1, 'created', $2, 'pmpa_backend')`,
      [rows[0].id, JSON.stringify(req.body)],
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/** PATCH /api/courts/:id/status — Atualiza status da quadra */
app.patch('/api/courts/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  const allowed = ['active', 'maintenance', 'closed'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Status inválido. Use: ${allowed.join(', ')}` });
  }

  try {
    const { rows: old } = await db.query(
      `SELECT status FROM quadras_pmpa WHERE id = $1`, [req.params.id],
    );
    if (!old.length) return res.status(404).json({ error: 'Quadra não encontrada.' });

    await db.query(
      `UPDATE quadras_pmpa SET status = $1, last_inspected = CURRENT_DATE WHERE id = $2`,
      [status, req.params.id],
    );

    await db.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, old_value, new_value, source)
       VALUES ('quadra_pmpa', $1, 'status_changed', $2, $3, 'pmpa_backend')`,
      [req.params.id, JSON.stringify({ status: old[0].status }), JSON.stringify({ status })],
    );

    res.json({ message: `Status atualizado para '${status}'.` });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================
// MÓDULO 2: Vitalidade Urbana (Analytics)
// ============================================================

/** GET /api/analytics/vitality/:courtId — Métricas de uso */
app.get('/api/analytics/vitality/:courtId', async (req: Request, res: Response) => {
  const { days = '30' } = req.query;
  try {
    const { rows } = await db.query(
      `SELECT
          DATE_TRUNC('day', measurement_time) AS dia,
          SUM(real_occupation)                AS jogadores_reais,
          SUM(scheduled_occupation)           AS jogadores_agendados,
          MAX(density)                        AS densidade_maxima,
          AVG(unique_users_count)             AS usuarios_unicos_media
       FROM court_vitality
       WHERE court_id = $1
         AND measurement_time >= NOW() - ($2::INTEGER || ' days')::INTERVAL
       GROUP BY dia
       ORDER BY dia DESC`,
      [req.params.courtId, days],
    );
    res.json({ courtId: req.params.courtId, period_days: Number(days), data: rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/analytics/dashboard — Dashboard do Secretário */
app.get('/api/analytics/dashboard', async (_req: Request, res: Response) => {
  try {
    const { rows } = await db.query(`SELECT * FROM mv_dashboard_pmpa`);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/analytics/refresh — Atualiza materialized view (via cron) */
app.post('/api/analytics/refresh', requireKratosSecret, async (_req, res) => {
  try {
    await db.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_pmpa`);
    res.json({ message: 'Dashboard atualizado.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================
// MÓDULO 3: Zeladoria — Webhook Kratos → PMPA
// ============================================================

/** POST /api/zeladoria/sync — Recebe report anonimizado do Kratos */
app.post('/api/zeladoria/sync', requireKratosSecret, async (req: Request, res: Response) => {
  const { kratos_report_id, court_id, praca_id, issue_type, photos, lat, lng } = req.body;

  if (!kratos_report_id || !court_id || !issue_type) {
    return res.status(400).json({ error: 'Campos obrigatórios: kratos_report_id, court_id, issue_type.' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO zeladoria_reports_pmpa
          (kratos_report_id, court_id, praca_id, issue_type, photos,
           gps_point, status)
       VALUES ($1, $2, $3, $4, $5,
               ST_SetSRID(ST_MakePoint($6, $7), 4326),
               'reported')
       ON CONFLICT (kratos_report_id) DO NOTHING
       RETURNING id`,
      [kratos_report_id, court_id, praca_id, issue_type,
       JSON.stringify(photos ?? []), lng ?? null, lat ?? null],
    );

    if (rows.length) {
      await db.query(
        `INSERT INTO audit_logs (entity_type, entity_id, action, new_value, source)
         VALUES ('zeladoria_report', $1, 'created', $2, 'kratos_webhook')`,
        [rows[0].id, JSON.stringify(req.body)],
      );
    }

    res.status(201).json({ message: 'Report sincronizado.', id: rows[0]?.id ?? null });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** PATCH /api/zeladoria/:id/status — Atualiza OS (Secretaria Municipal) */
app.patch('/api/zeladoria/:id/status', async (req: Request, res: Response) => {
  const { status, service_order_id, resolution_notes } = req.body;
  const allowed = ['reported', 'in_progress', 'resolved', 'closed'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Status inválido. Use: ${allowed.join(', ')}` });
  }

  try {
    const resolvedAt = status === 'resolved' ? 'CURRENT_TIMESTAMP' : 'NULL';
    await db.query(
      `UPDATE zeladoria_reports_pmpa
       SET status = $1,
           service_order_id = COALESCE($2, service_order_id),
           resolution_notes = COALESCE($3, resolution_notes),
           resolved_at = ${resolvedAt}
       WHERE id = $4`,
      [status, service_order_id ?? null, resolution_notes ?? null, req.params.id],
    );
    res.json({ message: `Report atualizado para '${status}'.` });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================
// MÓDULO 4: Audit Logs
// ============================================================

/** GET /api/audit — Consulta logs de auditoria com filtros */
app.get('/api/audit', async (req: Request, res: Response) => {
  const { entity_type, entity_id, limit = '50', offset = '0' } = req.query;
  try {
    const conditions: string[] = [];
    const params: any[]        = [];

    if (entity_type) {
      params.push(entity_type);
      conditions.push(`entity_type = $${params.length}`);
    }
    if (entity_id) {
      params.push(entity_id);
      conditions.push(`entity_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(Number(limit), Number(offset));

    const { rows } = await db.query(
      `SELECT * FROM audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Inicia servidor ──────────────────────────────────────────
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`🏛️  Backend PMPA rodando na porta ${PORT}`);
});

export default app;
