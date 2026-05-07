-- =============================================================================
-- PASSAGEM DE TURNO GRD - Setup completo (script unico, idempotente)
-- =============================================================================
-- Este script funciona em qualquer estado do banco:
--   - Banco zerado / novo projeto Supabase  -> cria tudo do zero
--   - Banco com schema antigo                -> derruba e recria com schema final
--   - Banco com schema atual                 -> recria limpo (com frota real)
--
-- Schema final inclui:
--   - 4 turnos (A, B, C, D)
--   - maintenance_type (CORRETIVA / PREVENTIVA)
--   - worked_in_shifts/dates + last_action_shift/date (rastreio cross-turno)
--   - 9 frotas reais + 36 ativos
--   - Sem OMs de exemplo (banco pronto pro uso real)
--
-- COMO USAR:
--   1. SQL Editor do Supabase -> New query
--   2. Cole TODO este arquivo -> Run
--   3. Confira em Table Editor: 9 fleets, 36 assets, work_orders vazia
-- =============================================================================


-- #############################################################################
-- PARTE 0 - LIMPEZA SEGURA (idempotente, sobrevive a qualquer estado)
-- #############################################################################

DROP SCHEMA IF EXISTS archive   CASCADE;
DROP SCHEMA IF EXISTS analytics CASCADE;

DROP TABLE IF EXISTS public.photos              CASCADE;
DROP TABLE IF EXISTS public.parts_used          CASCADE;
DROP TABLE IF EXISTS public.observations        CASCADE;
DROP TABLE IF EXISTS public.maintenance_actions CASCADE;
DROP TABLE IF EXISTS public.failure_events      CASCADE;
DROP TABLE IF EXISTS public.work_orders         CASCADE;
DROP TABLE IF EXISTS public.subsystems          CASCADE;
DROP TABLE IF EXISTS public.systems             CASCADE;
DROP TABLE IF EXISTS public.assets              CASCADE;
DROP TABLE IF EXISTS public.fleets              CASCADE;
DROP TABLE IF EXISTS public.field_messages      CASCADE;

DROP TYPE IF EXISTS wo_status            CASCADE;
DROP TYPE IF EXISTS maintenance_type     CASCADE;
DROP TYPE IF EXISTS observation_type     CASCADE;
DROP TYPE IF EXISTS observation_target   CASCADE;
DROP TYPE IF EXISTS observation_priority CASCADE;
DROP TYPE IF EXISTS observation_status   CASCADE;

DROP FUNCTION IF EXISTS public.set_updated_at()         CASCADE;
DROP FUNCTION IF EXISTS public.wo_set_closed_at()       CASCADE;
DROP FUNCTION IF EXISTS public.archive_old_work_orders() CASCADE;


-- #############################################################################
-- PARTE 1 - SCHEMA BASE
-- #############################################################################

CREATE SCHEMA IF NOT EXISTS archive;
CREATE SCHEMA IF NOT EXISTS analytics;

-- -------------------------------------------------------------- ENUM TYPES ---
CREATE TYPE wo_status AS ENUM (
  'PENDENTE','EM_EXECUCAO','CONCLUIDO','AGUARDANDO_PECA'
);

CREATE TYPE maintenance_type AS ENUM ('CORRETIVA', 'PREVENTIVA');

CREATE TYPE observation_type AS ENUM (
  'ARRANJO_TEMPORARIO','COMPONENTE_EM_RISCO','RECOMENDACAO_TROCA',
  'PENDENCIA_PCM','PENDENCIA_INSPECAO','PENDENCIA_ENGENHARIA','OBSERVACAO_GERAL'
);
CREATE TYPE observation_target   AS ENUM ('PCM','INSPECAO','ENGENHARIA','MANUTENCAO','OPERACAO','SUPRIMENTOS');
CREATE TYPE observation_priority AS ENUM ('BAIXA','MEDIA','ALTA','CRITICA');
CREATE TYPE observation_status   AS ENUM ('ABERTA','EM_ANALISE','RESOLVIDA','CANCELADA');

-- ------------------------------------------------------------------ FROTAS ---
CREATE TABLE public.fleets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  manufacturer  TEXT,
  model         TEXT,
  icon_key      TEXT,
  tag_range     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------ ATIVOS ---
CREATE TABLE public.assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag           TEXT UNIQUE NOT NULL,
  fleet_id      UUID REFERENCES public.fleets(id),
  description   TEXT,
  criticality   SMALLINT CHECK (criticality BETWEEN 1 AND 5) DEFAULT 3,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_assets_tag   ON public.assets(tag);
CREATE INDEX idx_assets_fleet ON public.assets(fleet_id);

-- ----------------------------------------------------- TAXONOMIA ISO 14224 ---
CREATE TABLE public.systems (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,
  sort_order    SMALLINT DEFAULT 0
);

CREATE TABLE public.subsystems (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id     UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  UNIQUE(system_id, name)
);

-- ------------------------------------------------- ORDENS DE MANUTENCAO -----
CREATE TABLE public.work_orders (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  om_number              TEXT UNIQUE NOT NULL,
  asset_id               UUID NOT NULL REFERENCES public.assets(id),
  status                 wo_status NOT NULL DEFAULT 'EM_EXECUCAO',
  shift                  CHAR(1) CHECK (shift IN ('A','B','C','D')),
  maintenance_type       maintenance_type NOT NULL DEFAULT 'CORRETIVA',
  opened_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at              TIMESTAMPTZ,
  -- Carry-over entre turnos (turno de origem)
  carried_from_shift     CHAR(1),
  carried_from_date      DATE,
  carry_note             TEXT,
  -- Rastreio cross-turno (qual(is) turno(s) trabalhou nessa OM)
  worked_in_shifts       CHAR(1)[] DEFAULT '{}',
  worked_in_dates        DATE[]    DEFAULT '{}',
  last_action_shift      CHAR(1),
  last_action_date       DATE,
  -- MTTR auto
  mttr_minutes           INTEGER GENERATED ALWAYS AS (
                            CASE WHEN closed_at IS NOT NULL
                                 THEN EXTRACT(EPOCH FROM (closed_at - opened_at))/60
                                 ELSE NULL END
                         ) STORED,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_wo_asset        ON public.work_orders(asset_id);
CREATE INDEX idx_wo_status       ON public.work_orders(status);
CREATE INDEX idx_wo_opened       ON public.work_orders(opened_at DESC);
CREATE INDEX idx_wo_shift_opened ON public.work_orders(shift, opened_at DESC);
CREATE INDEX idx_wo_maint_type   ON public.work_orders(maintenance_type);
CREATE INDEX idx_wo_last_action  ON public.work_orders(last_action_shift, last_action_date);

-- ----------------------------------------------- EVENTO DE FALHA ISO 14224 --
CREATE TABLE public.failure_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id          UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  system_id              UUID REFERENCES public.systems(id),
  subsystem_id           UUID REFERENCES public.subsystems(id),
  symptom                TEXT NOT NULL,
  presumed_cause         TEXT NOT NULL,
  intervention_type      TEXT NOT NULL,
  severity               TEXT CHECK (severity IN ('Incipiente','Degradado','Critico')),
  detection_method       TEXT,
  root_cause_notes       TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_fe_wo     ON public.failure_events(work_order_id);
CREATE INDEX idx_fe_system ON public.failure_events(system_id);

-- --------------------------------------------- ACOES DE MANUTENCAO ----------
CREATE TABLE public.maintenance_actions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id          UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  description            TEXT NOT NULL,
  performed_by           TEXT[],
  performed_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ma_wo ON public.maintenance_actions(work_order_id);

-- ------------------------------------ OBSERVACOES / PENDENCIAS TECNICAS ----
CREATE TABLE public.observations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id          UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  asset_id               UUID NOT NULL REFERENCES public.assets(id),
  type                   observation_type NOT NULL DEFAULT 'OBSERVACAO_GERAL',
  target                 observation_target NOT NULL DEFAULT 'MANUTENCAO',
  priority               observation_priority NOT NULL DEFAULT 'MEDIA',
  status                 observation_status NOT NULL DEFAULT 'ABERTA',
  description            TEXT NOT NULL,
  suggested_deadline     DATE,
  created_by             TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  resolved_at            TIMESTAMPTZ,
  resolved_by            TEXT,
  resolution_notes       TEXT
);
CREATE INDEX idx_obs_status   ON public.observations(status);
CREATE INDEX idx_obs_target   ON public.observations(target);
CREATE INDEX idx_obs_priority ON public.observations(priority);
CREATE INDEX idx_obs_asset    ON public.observations(asset_id);

-- -------------------------------------------------------- PECAS / FOTOS -----
CREATE TABLE public.parts_used (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id          UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  part_code              TEXT,
  part_name              TEXT NOT NULL,
  quantity               NUMERIC DEFAULT 1,
  unit                   TEXT DEFAULT 'un'
);

CREATE TABLE public.photos (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id          UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  storage_path           TEXT NOT NULL,
  caption                TEXT,
  uploaded_by            TEXT,
  uploaded_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_photos_wo ON public.photos(work_order_id);

CREATE TABLE public.field_messages (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text               TEXT NOT NULL,
  source                 TEXT DEFAULT 'app',
  shift                  CHAR(1),
  received_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extracted_json         JSONB,
  linked_work_order_ids  UUID[],
  processed              BOOLEAN DEFAULT FALSE
);

-- ----------------------------------------------- TRIGGERS DE TIMESTAMPS -----
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wo_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.wo_set_closed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'CONCLUIDO' AND OLD.status <> 'CONCLUIDO' AND NEW.closed_at IS NULL THEN
    NEW.closed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wo_closed_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.wo_set_closed_at();


-- #############################################################################
-- PARTE 2 - ARCHIVE + ANALYTICS (views otimizadas pra Power BI)
-- #############################################################################

CREATE TABLE archive.work_orders (
  LIKE public.work_orders INCLUDING ALL,
  archived_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  external_stop_at      TIMESTAMPTZ,
  external_release_at   TIMESTAMPTZ,
  external_duration_min INTEGER,
  loss_category         TEXT
);
CREATE TABLE archive.failure_events       (LIKE public.failure_events       INCLUDING ALL);
CREATE TABLE archive.maintenance_actions  (LIKE public.maintenance_actions  INCLUDING ALL);
CREATE TABLE archive.observations         (LIKE public.observations         INCLUDING ALL);
CREATE TABLE archive.parts_used           (LIKE public.parts_used           INCLUDING ALL);
CREATE TABLE archive.photos               (LIKE public.photos               INCLUDING ALL);

CREATE INDEX idx_arch_wo_asset  ON archive.work_orders(asset_id);
CREATE INDEX idx_arch_wo_opened ON archive.work_orders(opened_at DESC);
CREATE INDEX idx_arch_wo_closed ON archive.work_orders(closed_at DESC);

CREATE OR REPLACE VIEW analytics.all_work_orders AS
SELECT id, om_number, asset_id, status, shift, maintenance_type,
  opened_at, closed_at, mttr_minutes, carried_from_shift, carried_from_date,
  worked_in_shifts, worked_in_dates,
  NULL::TIMESTAMPTZ AS archived_at,
  NULL::TIMESTAMPTZ AS external_stop_at,
  NULL::TIMESTAMPTZ AS external_release_at,
  NULL::INTEGER     AS external_duration_min,
  NULL::TEXT        AS loss_category
FROM public.work_orders
UNION ALL
SELECT id, om_number, asset_id, status, shift, maintenance_type,
  opened_at, closed_at, mttr_minutes, carried_from_shift, carried_from_date,
  worked_in_shifts, worked_in_dates,
  archived_at, external_stop_at, external_release_at,
  external_duration_min, loss_category
FROM archive.work_orders;

CREATE OR REPLACE VIEW analytics.bad_actors AS
SELECT a.tag, f.name AS fleet, COUNT(wo.id) AS failure_count,
  ROUND(AVG(wo.mttr_minutes)::NUMERIC, 1)            AS avg_mttr_min,
  SUM(wo.mttr_minutes)                                AS total_downtime_min,
  ROUND(SUM(wo.mttr_minutes)::NUMERIC / 60, 1)        AS total_downtime_hr,
  COALESCE(SUM(wo.external_duration_min), SUM(wo.mttr_minutes)) AS effective_downtime_min
FROM public.assets a
LEFT JOIN public.fleets f ON f.id = a.fleet_id
JOIN analytics.all_work_orders wo ON wo.asset_id = a.id
WHERE wo.opened_at >= NOW() - INTERVAL '90 days' AND wo.status = 'CONCLUIDO'
GROUP BY a.tag, f.name
ORDER BY total_downtime_min DESC NULLS LAST;

CREATE OR REPLACE VIEW analytics.pareto_by_system AS
SELECT s.name AS system, COUNT(fe.id) AS failure_count,
  ROUND(AVG(wo.mttr_minutes)::NUMERIC, 1) AS avg_mttr_min,
  SUM(wo.mttr_minutes) AS total_downtime_min,
  ROUND(100.0 * COUNT(fe.id) / NULLIF(SUM(COUNT(fe.id)) OVER (), 0), 2) AS pct_of_total
FROM public.failure_events fe
JOIN public.systems s ON s.id = fe.system_id
JOIN analytics.all_work_orders wo ON wo.id = fe.work_order_id
WHERE wo.opened_at >= NOW() - INTERVAL '90 days'
GROUP BY s.name ORDER BY failure_count DESC;

CREATE OR REPLACE VIEW analytics.monthly_trend AS
SELECT DATE_TRUNC('month', wo.opened_at)::DATE AS month, s.name AS system,
  COUNT(*) AS failures, ROUND(AVG(wo.mttr_minutes)::NUMERIC, 1) AS avg_mttr_min,
  SUM(wo.mttr_minutes) AS total_downtime_min
FROM analytics.all_work_orders wo
JOIN public.failure_events fe ON fe.work_order_id = wo.id
JOIN public.systems s ON s.id = fe.system_id
WHERE wo.opened_at >= NOW() - INTERVAL '12 months'
GROUP BY 1, 2 ORDER BY 1 DESC, 3 DESC;

CREATE OR REPLACE VIEW analytics.open_observations_by_target AS
SELECT o.target, o.priority, COUNT(*) AS open_count,
  COUNT(*) FILTER (WHERE o.suggested_deadline < CURRENT_DATE) AS overdue_count,
  MIN(o.suggested_deadline) AS earliest_deadline
FROM public.observations o
WHERE o.status IN ('ABERTA','EM_ANALISE')
GROUP BY o.target, o.priority
ORDER BY CASE o.priority WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAIXA' THEN 4 END;

CREATE OR REPLACE VIEW analytics.mtbf_by_asset AS
WITH ordered AS (
  SELECT asset_id, opened_at,
    LAG(closed_at) OVER (PARTITION BY asset_id ORDER BY opened_at) AS prev_closed
  FROM analytics.all_work_orders
  WHERE status = 'CONCLUIDO' AND opened_at >= NOW() - INTERVAL '365 days'
)
SELECT a.tag, COUNT(o.asset_id) AS failures_year,
  ROUND(AVG(EXTRACT(EPOCH FROM (o.opened_at - o.prev_closed))/3600)::NUMERIC, 1) AS mtbf_hours
FROM public.assets a
LEFT JOIN ordered o ON o.asset_id = a.id AND o.prev_closed IS NOT NULL
GROUP BY a.tag;


-- #############################################################################
-- PARTE 3 - ROW LEVEL SECURITY + REALTIME
-- #############################################################################

ALTER TABLE public.fleets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.systems              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subsystems           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failure_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_actions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts_used           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_messages       ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('fleets','assets','systems','subsystems','work_orders',
                        'failure_events','maintenance_actions','observations',
                        'parts_used','photos','field_messages')
  LOOP
    EXECUTE format('CREATE POLICY "auth_read_%I"   ON public.%I FOR SELECT USING (auth.role() = ''authenticated'')', t, t);
    EXECUTE format('CREATE POLICY "auth_write_%I"  ON public.%I FOR INSERT WITH CHECK (auth.role() = ''authenticated'')', t, t);
    EXECUTE format('CREATE POLICY "auth_update_%I" ON public.%I FOR UPDATE USING (auth.role() = ''authenticated'')', t, t);
    EXECUTE format('CREATE POLICY "anon_read_%I"   ON public.%I FOR SELECT USING (true)', t, t);
  END LOOP;
END $$;

-- Realtime - habilita push pras tabelas que o Kanban observa
DO $$
BEGIN
  -- pode ja existir, ignora erro
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.failure_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.observations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- #############################################################################
-- PARTE 4 - TAXONOMIA ISO 14224 (sistemas e subsistemas globais)
-- #############################################################################

INSERT INTO public.systems (name, sort_order) VALUES
  ('Motor Diesel',       1), ('Transmissao', 2), ('Sistema Hidraulico', 3),
  ('Sistema de Direcao', 4), ('Sistema de Freios',  5), ('Sistema Eletrico',   6),
  ('Estrutural/Chassi',  7), ('Pneus/Rodagem',      8);

INSERT INTO public.subsystems (system_id, name)
SELECT s.id, sub.name FROM public.systems s
JOIN (VALUES
  ('Motor Diesel','Bloco/Cabecote'),('Motor Diesel','Sistema de Combustivel'),
  ('Motor Diesel','Sistema de Lubrificacao'),('Motor Diesel','Sistema de Arrefecimento'),
  ('Motor Diesel','Turbo/Admissao'),('Motor Diesel','Sistema de Escape'),
  ('Transmissao','Conversor de Torque'),('Transmissao','Caixa de Marchas'),
  ('Transmissao','Eixos Diferenciais'),('Transmissao','Comando Final'),
  ('Sistema Hidraulico','Grupo Principal'),('Sistema Hidraulico','Bomba Hidraulica'),
  ('Sistema Hidraulico','Cilindros'),('Sistema Hidraulico','Mangueiras/Linhas'),
  ('Sistema Hidraulico','Valvulas de Controle'),('Sistema Hidraulico','Resfriador'),
  ('Sistema de Direcao','Bomba de Direcao'),('Sistema de Direcao','Cilindros de Direcao'),
  ('Sistema de Direcao','Valvula Orbitrol'),('Sistema de Direcao','Mangueiras'),
  ('Sistema de Freios','Sistema de Servico'),('Sistema de Freios','Freio de Estacionamento'),
  ('Sistema de Freios','Retardador'),('Sistema de Freios','Sensores'),
  ('Sistema Eletrico','Alternador/Partida'),('Sistema Eletrico','Sensores'),
  ('Sistema Eletrico','Chicote/Conectores'),('Sistema Eletrico','Iluminacao'),
  ('Sistema Eletrico','Painel/ECU'),
  ('Estrutural/Chassi','Chassi Principal'),('Estrutural/Chassi','Cacamba/Concha'),
  ('Estrutural/Chassi','Mancais/Pinos'),('Estrutural/Chassi','Articulacao'),
  ('Pneus/Rodagem','Pneus'),('Pneus/Rodagem','Rodas/Aros'),('Pneus/Rodagem','Cubo de Roda')
) AS sub(system_name, name) ON s.name = sub.system_name;


-- #############################################################################
-- PARTE 5 - FROTA REAL (9 frotas de carga e infra + 36 ativos)
-- #############################################################################

INSERT INTO public.fleets (code, name, manufacturer, model, icon_key, tag_range) VALUES
  ('caminhao_fe',            'Caminhao Fora de Estrada',  'Caterpillar',           '777C',                   'caminhao_fe',            '5704'),
  ('carregadeira',           'Carregadeira',              'Caterpillar',           '988K',                   'carregadeira',           '7001-7099'),
  ('escavadeira',            'Escavadeira',               'Caterpillar',           '395',                    'escavadeira',            '9401-9499'),
  ('escavadeira_braco_longo','Escavadeira Braco Longo',   'Caterpillar',           '320',                    'escavadeira_braco_longo','8701-9299'),
  ('motoniveladora',         'Motoniveladora',            'Caterpillar / Komatsu', '160M / 16M / GD655',     'motoniveladora',         '7401-8399'),
  ('retroescavadeira',       'Retroescavadeira',          'Caterpillar',           '416F2 / 420F2',          'retroescavadeira',       '8602-9199'),
  ('trator_esteira',         'Trator de Esteira',         'Caterpillar / Komatsu', 'D6T / D8R / D61EX',      'trator_esteira',         '201-8899'),
  ('trator_agricola',        'Trator Agricola',           'Diversos',              'Scrapers',               'trator_agricola',        '8901'),
  ('trator_pneu',            'Trator de Pneu',            'Caterpillar',           '824H',                   'trator_pneu',            '3308-3309');

INSERT INTO public.assets (tag, fleet_id, description, criticality)
SELECT a.tag, f.id, a.desc_, a.crit
FROM public.fleets f
JOIN (VALUES
  -- Trator de Esteira
  ('201',  'trator_esteira',         'Trator de Esteira D8R',                 5),
  ('8501', 'trator_esteira',         'Trator de Esteira D61EX',               5),
  ('8502', 'trator_esteira',         'Trator de Esteira D61EX',               5),
  ('8503', 'trator_esteira',         'Trator de Esteira D61EX',               5),
  ('8801', 'trator_esteira',         'Trator de Esteira D6T',                 4),
  ('8802', 'trator_esteira',         'Trator de Esteira D6T',                 4),
  -- Retroescavadeira
  ('8602', 'retroescavadeira',       'Retroescavadeira CAT 416F2',            3),
  ('8603', 'retroescavadeira',       'Retroescavadeira CAT 416F2',            3),
  ('9101', 'retroescavadeira',       'Retroescavadeira CAT 420F2',            3),
  ('9102', 'retroescavadeira',       'Retroescavadeira CAT 420F2',            3),
  ('9103', 'retroescavadeira',       'Retroescavadeira CAT 420',              3),
  ('9104', 'retroescavadeira',       'Retroescavadeira CAT 419',              3),
  -- Trator agricola
  ('8901', 'trator_agricola',        'Trator Agricola Scrapers',              3),
  -- Carregadeira
  ('7001', 'carregadeira',           'Carregadeira CAT 988K',                 5),
  ('7004', 'carregadeira',           'Carregadeira CAT 988K',                 5),
  ('7005', 'carregadeira',           'Carregadeira CAT 988K',                 5),
  -- Caminhao Fora de Estrada
  ('5704', 'caminhao_fe',            'Caminhao Fora de Estrada CAT 777C',     5),
  -- Motoniveladoras
  ('8201', 'motoniveladora',         'Motoniveladora CAT 160M',               4),
  ('8202', 'motoniveladora',         'Motoniveladora CAT 160M',               4),
  ('7401', 'motoniveladora',         'Motoniveladora Komatsu GD655',          4),
  ('8301', 'motoniveladora',         'Motoniveladora CAT 16M',                4),
  ('8302', 'motoniveladora',         'Motoniveladora CAT 16M',                4),
  ('8303', 'motoniveladora',         'Motoniveladora CAT 16M',                4),
  -- Trator de Pneu
  ('3308', 'trator_pneu',            'Trator de Pneu CAT 824H',               4),
  ('3309', 'trator_pneu',            'Trator de Pneu CAT 824H',               4),
  -- Escavadeira braco longo
  ('9201', 'escavadeira_braco_longo','Escavadeira Braco Longo CAT 320',       4),
  ('8701', 'escavadeira_braco_longo','Escavadeira Braco Longo CAT 320',       4),
  ('8702', 'escavadeira_braco_longo','Escavadeira Braco Longo CAT 320',       4),
  ('8703', 'escavadeira_braco_longo','Escavadeira Braco Longo CAT 320',       4),
  -- Escavadeiras 395
  ('9401', 'escavadeira',            'Escavadeira CAT 395',                   5),
  ('9402', 'escavadeira',            'Escavadeira CAT 395',                   5),
  ('9403', 'escavadeira',            'Escavadeira CAT 395',                   5),
  ('9404', 'escavadeira',            'Escavadeira CAT 395',                   5),
  ('9405', 'escavadeira',            'Escavadeira CAT 395',                   5),
  ('9406', 'escavadeira',            'Escavadeira CAT 395',                   5),
  ('9407', 'escavadeira',            'Escavadeira CAT 395',                   5)
) AS a(tag, fleet_code, desc_, crit) ON f.code = a.fleet_code;


-- =============================================================================
-- FIM. Confira:
--   - Table Editor -> public.fleets (9 linhas)
--   - Table Editor -> public.assets (36 linhas)
--   - Table Editor -> public.systems (8 linhas)
--   - Table Editor -> public.subsystems (36 linhas)
--   - Table Editor -> public.work_orders (vazia - pronto pro uso real)
-- =============================================================================
