-- =============================================================================
-- CampoIQ — Arquivamento automatico + Views analiticas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ARCHIVE SCHEMA — espelho otimizado para historico
-- -----------------------------------------------------------------------------
CREATE TABLE archive.work_orders (
  LIKE public.work_orders INCLUDING ALL,
  archived_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Campos cruzados com sistema externo de tempos (preenchidos no arquivamento)
  external_stop_at      TIMESTAMPTZ,
  external_release_at   TIMESTAMPTZ,
  external_duration_min INTEGER,
  loss_category         TEXT                       -- 'Mecanica','Eletrica','Operacional'...
);

CREATE TABLE archive.failure_events (LIKE public.failure_events INCLUDING ALL);
CREATE TABLE archive.maintenance_actions (LIKE public.maintenance_actions INCLUDING ALL);
CREATE TABLE archive.observations (LIKE public.observations INCLUDING ALL);
CREATE TABLE archive.parts_used (LIKE public.parts_used INCLUDING ALL);
CREATE TABLE archive.photos (LIKE public.photos INCLUDING ALL);

CREATE INDEX idx_arch_wo_asset ON archive.work_orders(asset_id);
CREATE INDEX idx_arch_wo_opened ON archive.work_orders(opened_at DESC);
CREATE INDEX idx_arch_wo_closed ON archive.work_orders(closed_at DESC);

-- -----------------------------------------------------------------------------
-- FUNCAO DE ARQUIVAMENTO (move WOs concluidas ha mais de 60 dias)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_old_work_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  moved_count INTEGER := 0;
BEGIN
  -- 1) Copia para archive
  WITH old_wos AS (
    SELECT id FROM public.work_orders
    WHERE status = 'CONCLUIDO'
      AND closed_at < NOW() - INTERVAL '60 days'
  ),
  ins_wo AS (
    INSERT INTO archive.work_orders
    SELECT wo.*, NOW(), NULL, NULL, NULL, NULL
    FROM public.work_orders wo
    WHERE wo.id IN (SELECT id FROM old_wos)
    RETURNING id
  ),
  ins_fe AS (
    INSERT INTO archive.failure_events
    SELECT fe.* FROM public.failure_events fe
    WHERE fe.work_order_id IN (SELECT id FROM old_wos)
  ),
  ins_ma AS (
    INSERT INTO archive.maintenance_actions
    SELECT ma.* FROM public.maintenance_actions ma
    WHERE ma.work_order_id IN (SELECT id FROM old_wos)
  ),
  ins_obs AS (
    INSERT INTO archive.observations
    SELECT obs.* FROM public.observations obs
    WHERE obs.work_order_id IN (SELECT id FROM old_wos)
  ),
  ins_parts AS (
    INSERT INTO archive.parts_used
    SELECT p.* FROM public.parts_used p
    WHERE p.work_order_id IN (SELECT id FROM old_wos)
  ),
  ins_photos AS (
    INSERT INTO archive.photos
    SELECT ph.* FROM public.photos ph
    WHERE ph.work_order_id IN (SELECT id FROM old_wos)
  )
  -- 2) Deleta do public (cascata limpa os filhos)
  DELETE FROM public.work_orders WHERE id IN (SELECT id FROM old_wos);

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- AGENDAMENTO via pg_cron (executa todo dia as 03:00 UTC)
-- Ative pg_cron no Supabase dashboard: Database -> Extensions -> pg_cron
-- -----------------------------------------------------------------------------
-- DESCOMENTE apos habilitar a extensao pg_cron no painel Supabase:
--
-- SELECT cron.schedule(
--   'campoiq-archive-daily',
--   '0 3 * * *',
--   $$SELECT public.archive_old_work_orders();$$
-- );

-- =============================================================================
-- ANALYTICS — views otimizadas para Power BI / perfil de perda
-- =============================================================================

-- -----------------------------------------------------------------------------
-- UNIFICADA: work_orders ativos + arquivados (para analytics)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW analytics.all_work_orders AS
SELECT
  id, om_number, asset_id, status, shift, opened_at, closed_at,
  mttr_minutes, carried_from_shift, carried_from_date,
  NULL::TIMESTAMPTZ AS archived_at,
  NULL::TIMESTAMPTZ AS external_stop_at,
  NULL::TIMESTAMPTZ AS external_release_at,
  NULL::INTEGER     AS external_duration_min,
  NULL::TEXT        AS loss_category
FROM public.work_orders
UNION ALL
SELECT
  id, om_number, asset_id, status, shift, opened_at, closed_at,
  mttr_minutes, carried_from_shift, carried_from_date,
  archived_at, external_stop_at, external_release_at,
  external_duration_min, loss_category
FROM archive.work_orders;

-- -----------------------------------------------------------------------------
-- BAD ACTORS — ranking de ativos por perda (ultimos 90 dias)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW analytics.bad_actors AS
SELECT
  a.tag,
  f.name AS fleet,
  COUNT(wo.id)                        AS failure_count,
  ROUND(AVG(wo.mttr_minutes)::NUMERIC, 1) AS avg_mttr_min,
  SUM(wo.mttr_minutes)                AS total_downtime_min,
  ROUND(SUM(wo.mttr_minutes)::NUMERIC / 60, 1) AS total_downtime_hr,
  COALESCE(SUM(wo.external_duration_min), SUM(wo.mttr_minutes)) AS effective_downtime_min
FROM public.assets a
LEFT JOIN public.fleets f ON f.id = a.fleet_id
JOIN analytics.all_work_orders wo ON wo.asset_id = a.id
WHERE wo.opened_at >= NOW() - INTERVAL '90 days'
  AND wo.status = 'CONCLUIDO'
GROUP BY a.tag, f.name
ORDER BY total_downtime_min DESC NULLS LAST;

-- -----------------------------------------------------------------------------
-- PARETO por SISTEMA (falhas por sistema nos ultimos 90 dias)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW analytics.pareto_by_system AS
SELECT
  s.name AS system,
  COUNT(fe.id)                        AS failure_count,
  ROUND(AVG(wo.mttr_minutes)::NUMERIC, 1) AS avg_mttr_min,
  SUM(wo.mttr_minutes)                AS total_downtime_min,
  ROUND(100.0 * COUNT(fe.id) / NULLIF(SUM(COUNT(fe.id)) OVER (), 0), 2) AS pct_of_total
FROM public.failure_events fe
JOIN public.systems s ON s.id = fe.system_id
JOIN analytics.all_work_orders wo ON wo.id = fe.work_order_id
WHERE wo.opened_at >= NOW() - INTERVAL '90 days'
GROUP BY s.name
ORDER BY failure_count DESC;

-- -----------------------------------------------------------------------------
-- TENDENCIA MENSAL (para graficos de linha no Power BI)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW analytics.monthly_trend AS
SELECT
  DATE_TRUNC('month', wo.opened_at)::DATE AS month,
  s.name AS system,
  COUNT(*)                       AS failures,
  ROUND(AVG(wo.mttr_minutes)::NUMERIC, 1) AS avg_mttr_min,
  SUM(wo.mttr_minutes)           AS total_downtime_min
FROM analytics.all_work_orders wo
JOIN public.failure_events fe ON fe.work_order_id = wo.id
JOIN public.systems s ON s.id = fe.system_id
WHERE wo.opened_at >= NOW() - INTERVAL '12 months'
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;

-- -----------------------------------------------------------------------------
-- OBSERVACOES ABERTAS agrupadas por destinatario (backlog acionavel)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW analytics.open_observations_by_target AS
SELECT
  o.target,
  o.priority,
  COUNT(*) AS open_count,
  COUNT(*) FILTER (WHERE o.suggested_deadline < CURRENT_DATE) AS overdue_count,
  MIN(o.suggested_deadline) AS earliest_deadline
FROM public.observations o
WHERE o.status IN ('ABERTA','EM_ANALISE')
GROUP BY o.target, o.priority
ORDER BY
  CASE o.priority
    WHEN 'CRITICA' THEN 1
    WHEN 'ALTA'    THEN 2
    WHEN 'MEDIA'   THEN 3
    WHEN 'BAIXA'   THEN 4
  END;

-- -----------------------------------------------------------------------------
-- MTBF por ativo (tempo medio entre falhas)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW analytics.mtbf_by_asset AS
WITH ordered AS (
  SELECT
    asset_id,
    opened_at,
    LAG(closed_at) OVER (PARTITION BY asset_id ORDER BY opened_at) AS prev_closed
  FROM analytics.all_work_orders
  WHERE status = 'CONCLUIDO'
    AND opened_at >= NOW() - INTERVAL '365 days'
)
SELECT
  a.tag,
  COUNT(o.asset_id) AS failures_year,
  ROUND(AVG(EXTRACT(EPOCH FROM (o.opened_at - o.prev_closed))/3600)::NUMERIC, 1) AS mtbf_hours
FROM public.assets a
LEFT JOIN ordered o ON o.asset_id = a.id AND o.prev_closed IS NOT NULL
GROUP BY a.tag;
