-- =============================================================================
-- CampoIQ — SQL UNICO (cole tudo de uma vez no Supabase SQL Editor e RUN)
-- =============================================================================
-- Este arquivo contem, na ordem correta:
--   1) Schema base (tabelas, enums, triggers)
--   2) Archive + views analytics (Power BI / perfil de perda)
--   3) Row Level Security + Realtime
--   4) Seed (frotas, sistemas, ativos e 6 OMs de exemplo)
--
-- COMO USAR:
--   1. Abra https://supabase.com/dashboard -> seu projeto -> SQL Editor
--   2. Clique em "New query", cole ESTE arquivo inteiro, clique em RUN
--   3. Confira em Table Editor que as tabelas aparecem em public/archive/analytics
--   4. Pronto. Nao precisa executar mais nada no SQL.
-- =============================================================================


-- #############################################################################
-- PARTE 0 — RESET (torna o script idempotente: pode rodar varias vezes)
-- #############################################################################
-- Derruba tudo o que este script cria, na ordem segura.
-- Em um banco limpo isso nao remove nada (IF EXISTS), entao e seguro manter.

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
DROP TYPE IF EXISTS observation_type     CASCADE;
DROP TYPE IF EXISTS observation_target   CASCADE;
DROP TYPE IF EXISTS observation_priority CASCADE;
DROP TYPE IF EXISTS observation_status   CASCADE;

DROP FUNCTION IF EXISTS public.set_updated_at()         CASCADE;
DROP FUNCTION IF EXISTS public.wo_set_closed_at()       CASCADE;
DROP FUNCTION IF EXISTS public.archive_old_work_orders() CASCADE;


-- #############################################################################
-- PARTE 1 — SCHEMA BASE
-- #############################################################################

CREATE SCHEMA IF NOT EXISTS archive;
CREATE SCHEMA IF NOT EXISTS analytics;

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

CREATE TABLE public.assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag           TEXT UNIQUE NOT NULL,
  fleet_id      UUID REFERENCES public.fleets(id),
  description   TEXT,
  criticality   SMALLINT CHECK (criticality BETWEEN 1 AND 5) DEFAULT 3,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_assets_tag ON public.assets(tag);
CREATE INDEX idx_assets_fleet ON public.assets(fleet_id);

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

CREATE TYPE wo_status AS ENUM ('PENDENTE','EM_EXECUCAO','CONCLUIDO','AGUARDANDO_PECA');

CREATE TABLE public.work_orders (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  om_number              TEXT UNIQUE NOT NULL,
  asset_id               UUID NOT NULL REFERENCES public.assets(id),
  status                 wo_status NOT NULL DEFAULT 'EM_EXECUCAO',
  shift                  CHAR(1) CHECK (shift IN ('A','B','C')),
  opened_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at              TIMESTAMPTZ,
  carried_from_shift     CHAR(1),
  carried_from_date      DATE,
  carry_note             TEXT,
  mttr_minutes           INTEGER GENERATED ALWAYS AS (
                            CASE WHEN closed_at IS NOT NULL
                                 THEN EXTRACT(EPOCH FROM (closed_at - opened_at))/60
                                 ELSE NULL END
                         ) STORED,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_wo_asset ON public.work_orders(asset_id);
CREATE INDEX idx_wo_status ON public.work_orders(status);
CREATE INDEX idx_wo_opened ON public.work_orders(opened_at DESC);
CREATE INDEX idx_wo_shift_opened ON public.work_orders(shift, opened_at DESC);

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
CREATE INDEX idx_fe_wo ON public.failure_events(work_order_id);
CREATE INDEX idx_fe_system ON public.failure_events(system_id);

CREATE TABLE public.maintenance_actions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id          UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  description            TEXT NOT NULL,
  performed_by           TEXT[],
  performed_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ma_wo ON public.maintenance_actions(work_order_id);

CREATE TYPE observation_type AS ENUM (
  'ARRANJO_TEMPORARIO','COMPONENTE_EM_RISCO','RECOMENDACAO_TROCA',
  'PENDENCIA_PCM','PENDENCIA_INSPECAO','PENDENCIA_ENGENHARIA','OBSERVACAO_GERAL'
);
CREATE TYPE observation_target   AS ENUM ('PCM','INSPECAO','ENGENHARIA','MANUTENCAO','OPERACAO','SUPRIMENTOS');
CREATE TYPE observation_priority AS ENUM ('BAIXA','MEDIA','ALTA','CRITICA');
CREATE TYPE observation_status   AS ENUM ('ABERTA','EM_ANALISE','RESOLVIDA','CANCELADA');

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
CREATE INDEX idx_obs_status ON public.observations(status);
CREATE INDEX idx_obs_target ON public.observations(target);
CREATE INDEX idx_obs_priority ON public.observations(priority);
CREATE INDEX idx_obs_asset ON public.observations(asset_id);

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
-- PARTE 2 — ARCHIVE + ANALYTICS
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

CREATE OR REPLACE FUNCTION public.archive_old_work_orders()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE moved_count INTEGER := 0;
BEGIN
  WITH old_wos AS (
    SELECT id FROM public.work_orders
    WHERE status = 'CONCLUIDO' AND closed_at < NOW() - INTERVAL '60 days'
  ),
  ins_wo AS (
    INSERT INTO archive.work_orders
    SELECT wo.*, NOW(), NULL, NULL, NULL, NULL FROM public.work_orders wo
    WHERE wo.id IN (SELECT id FROM old_wos) RETURNING id
  ),
  ins_fe AS (
    INSERT INTO archive.failure_events SELECT fe.* FROM public.failure_events fe
    WHERE fe.work_order_id IN (SELECT id FROM old_wos)
  ),
  ins_ma AS (
    INSERT INTO archive.maintenance_actions SELECT ma.* FROM public.maintenance_actions ma
    WHERE ma.work_order_id IN (SELECT id FROM old_wos)
  ),
  ins_obs AS (
    INSERT INTO archive.observations SELECT obs.* FROM public.observations obs
    WHERE obs.work_order_id IN (SELECT id FROM old_wos)
  ),
  ins_parts AS (
    INSERT INTO archive.parts_used SELECT p.* FROM public.parts_used p
    WHERE p.work_order_id IN (SELECT id FROM old_wos)
  ),
  ins_photos AS (
    INSERT INTO archive.photos SELECT ph.* FROM public.photos ph
    WHERE ph.work_order_id IN (SELECT id FROM old_wos)
  )
  DELETE FROM public.work_orders WHERE id IN (SELECT id FROM old_wos);
  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$;

-- Views analytics
CREATE OR REPLACE VIEW analytics.all_work_orders AS
SELECT id, om_number, asset_id, status, shift, opened_at, closed_at,
  mttr_minutes, carried_from_shift, carried_from_date,
  NULL::TIMESTAMPTZ AS archived_at, NULL::TIMESTAMPTZ AS external_stop_at,
  NULL::TIMESTAMPTZ AS external_release_at,
  NULL::INTEGER AS external_duration_min, NULL::TEXT AS loss_category
FROM public.work_orders
UNION ALL
SELECT id, om_number, asset_id, status, shift, opened_at, closed_at,
  mttr_minutes, carried_from_shift, carried_from_date,
  archived_at, external_stop_at, external_release_at,
  external_duration_min, loss_category
FROM archive.work_orders;

CREATE OR REPLACE VIEW analytics.bad_actors AS
SELECT a.tag, f.name AS fleet, COUNT(wo.id) AS failure_count,
  ROUND(AVG(wo.mttr_minutes)::NUMERIC, 1) AS avg_mttr_min,
  SUM(wo.mttr_minutes) AS total_downtime_min,
  ROUND(SUM(wo.mttr_minutes)::NUMERIC / 60, 1) AS total_downtime_hr,
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
-- PARTE 3 — ROW LEVEL SECURITY + REALTIME
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.failure_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.observations;


-- #############################################################################
-- PARTE 4 — SEED (dados iniciais + 6 OMs de exemplo)
-- #############################################################################

INSERT INTO public.fleets (code, name, manufacturer, model, icon_key, tag_range) VALUES
  ('caminhao_fe',     'Caminhoes Fora-de-Estrada', 'Caterpillar', '797F',        'caminhao_fe',     '7000-7099'),
  ('escavadeira',     'Escavadeiras Hidraulicas',  'Komatsu',     'PC2000-11',   'escavadeira',     '8500-8599'),
  ('trator_esteira',  'Tratores de Esteiras',      'Caterpillar', 'D11T',        'trator_esteira',  '8800-8899'),
  ('pa_carregadeira', 'Pas Carregadeiras',         'Caterpillar', '994K',        'pa_carregadeira', '9400-9499'),
  ('perfuratriz',     'Perfuratrizes',             'Atlas Copco', 'Pit Viper',   'perfuratriz',     '6000-6099');

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

INSERT INTO public.assets (tag, fleet_id, description, criticality)
SELECT tag, f.id, desc_, crit FROM public.fleets f
JOIN (VALUES
  ('7001','caminhao_fe','Caminhao Fora-de-Estrada',5),
  ('7002','caminhao_fe','Caminhao Fora-de-Estrada',5),
  ('7004','caminhao_fe','Caminhao Fora-de-Estrada',5),
  ('8501','escavadeira','Escavadeira Hidraulica',5),
  ('8502','escavadeira','Escavadeira Hidraulica',5),
  ('8503','escavadeira','Escavadeira Hidraulica',5),
  ('8801','trator_esteira','Trator de Esteiras',4),
  ('8802','trator_esteira','Trator de Esteiras',4),
  ('9401','pa_carregadeira','Pa Carregadeira',5),
  ('9402','pa_carregadeira','Pa Carregadeira',5),
  ('9403','pa_carregadeira','Pa Carregadeira',5),
  ('9404','pa_carregadeira','Pa Carregadeira',5)
) AS a(tag, fleet_code, desc_, crit) ON f.code = a.fleet_code;

DO $$
DECLARE wo_id UUID; a_id UUID; s_id UUID; sub_id UUID;
BEGIN
  -- OM 4.972.218 - 9401 - CONCLUIDO turno A
  SELECT id INTO a_id FROM public.assets WHERE tag = '9401';
  INSERT INTO public.work_orders (om_number, asset_id, status, shift, opened_at, closed_at)
  VALUES ('4.972.218', a_id, 'CONCLUIDO', 'A',
          (CURRENT_DATE + TIME '06:40')::TIMESTAMPTZ,
          (CURRENT_DATE + TIME '08:05')::TIMESTAMPTZ) RETURNING id INTO wo_id;
  SELECT id INTO s_id   FROM public.systems    WHERE name = 'Estrutural/Chassi';
  SELECT id INTO sub_id FROM public.subsystems WHERE name = 'Mancais/Pinos' AND system_id = s_id;
  INSERT INTO public.failure_events (work_order_id, system_id, subsystem_id, symptom, presumed_cause, intervention_type, severity)
  VALUES (wo_id, s_id, sub_id, 'Folga mecanica', 'Torque inadequado / folga', 'Ajuste / Reaperto (Adjust)', 'Degradado');
  INSERT INTO public.maintenance_actions (work_order_id, description, performed_by)
  VALUES (wo_id, 'Parafusos do mancal do pino da concha folgados. Feita limpeza, aperto e liberacao.',
          ARRAY['Andre Neto','Joelson Ferreira','Elberson Sousa','Kleiton Souza']);

  -- OM 4.972.221 - 9403 - CONCLUIDO turno A
  SELECT id INTO a_id FROM public.assets WHERE tag = '9403';
  INSERT INTO public.work_orders (om_number, asset_id, status, shift, opened_at, closed_at)
  VALUES ('4.972.221', a_id, 'CONCLUIDO', 'A',
          (CURRENT_DATE + TIME '07:15')::TIMESTAMPTZ,
          (CURRENT_DATE + TIME '08:20')::TIMESTAMPTZ) RETURNING id INTO wo_id;
  SELECT id INTO s_id   FROM public.systems    WHERE name = 'Motor Diesel';
  SELECT id INTO sub_id FROM public.subsystems WHERE name = 'Sistema de Combustivel' AND system_id = s_id;
  INSERT INTO public.failure_events (work_order_id, system_id, subsystem_id, symptom, presumed_cause, intervention_type, severity)
  VALUES (wo_id, s_id, sub_id, 'Perda de potencia', 'Falha de montagem/instalacao', 'Reparo (Repair)', 'Degradado');
  INSERT INTO public.maintenance_actions (work_order_id, description, performed_by)
  VALUES (wo_id, 'Sensor do filtro de combustivel nao plugado. Reconectado, trocado filtro, testado. Liberado.',
          ARRAY['Andre Neto','Joelson Ferreira','Elberson Sousa','Kleiton Souza']);
  INSERT INTO public.parts_used (work_order_id, part_name, quantity, unit)
  VALUES (wo_id, 'Filtro de combustivel', 1, 'un');

  -- OM 4.972.151 - 8502 - CONCLUIDO turno C
  SELECT id INTO a_id FROM public.assets WHERE tag = '8502';
  INSERT INTO public.work_orders (om_number, asset_id, status, shift, opened_at, closed_at)
  VALUES ('4.972.151', a_id, 'CONCLUIDO', 'C',
          (CURRENT_DATE + TIME '23:45' - INTERVAL '1 day')::TIMESTAMPTZ,
          (CURRENT_DATE + TIME '00:28')::TIMESTAMPTZ) RETURNING id INTO wo_id;
  SELECT id INTO s_id   FROM public.systems    WHERE name = 'Sistema Hidraulico';
  SELECT id INTO sub_id FROM public.subsystems WHERE name = 'Mangueiras/Linhas' AND system_id = s_id;
  INSERT INTO public.failure_events (work_order_id, system_id, subsystem_id, symptom, presumed_cause, intervention_type, severity)
  VALUES (wo_id, s_id, sub_id, 'Vazamento externo', 'Torque inadequado / folga', 'Ajuste / Reaperto (Adjust)', 'Degradado');
  INSERT INTO public.maintenance_actions (work_order_id, description, performed_by)
  VALUES (wo_id, 'Mangueira piloto folgada. Reaperto e complemento de fluido. Liberado.',
          ARRAY['Silvio','Carlos Alexandre']);
  INSERT INTO public.observations (work_order_id, asset_id, type, target, priority, description, suggested_deadline, created_by)
  VALUES (wo_id, a_id, 'COMPONENTE_EM_RISCO', 'INSPECAO', 'ALTA',
          'Mangueira piloto do grupo hidraulico com desgaste visivel na conexao. Programar substituicao preventiva.',
          CURRENT_DATE + INTERVAL '15 days', 'Silvio');

  -- OM 4.972.225 - 7004 - EM_EXECUCAO turno C (veio do A)
  SELECT id INTO a_id FROM public.assets WHERE tag = '7004';
  INSERT INTO public.work_orders (om_number, asset_id, status, shift, opened_at, carried_from_shift, carry_note)
  VALUES ('4.972.225', a_id, 'EM_EXECUCAO', 'C',
          (CURRENT_DATE + TIME '00:15')::TIMESTAMPTZ, 'A',
          'Turno seguinte pega o cilindro da 7004 e leva para o Aviso') RETURNING id INTO wo_id;
  SELECT id INTO s_id   FROM public.systems    WHERE name = 'Sistema de Direcao';
  SELECT id INTO sub_id FROM public.subsystems WHERE name = 'Cilindros de Direcao' AND system_id = s_id;
  INSERT INTO public.failure_events (work_order_id, system_id, subsystem_id, symptom, presumed_cause, intervention_type, severity)
  VALUES (wo_id, s_id, sub_id, 'Vazamento externo', 'Desgaste por uso', 'Substituicao (Replace)', 'Critico');
  INSERT INTO public.maintenance_actions (work_order_id, description, performed_by)
  VALUES (wo_id, 'Cilindro disponivel na oficina MB. Fazer reversao L/D<->L/E.', ARRAY['Silvio','Carlos Alexandre']);
  INSERT INTO public.observations (work_order_id, asset_id, type, target, priority, description, created_by)
  VALUES (wo_id, a_id, 'ARRANJO_TEMPORARIO', 'PCM', 'ALTA',
          'Reversao de cilindros e solucao temporaria. Programar substituicao definitiva dos dois cilindros.',
          'Silvio');

  -- OM 4.971.998 - 8801 - AGUARDANDO_PECA turno B
  SELECT id INTO a_id FROM public.assets WHERE tag = '8801';
  INSERT INTO public.work_orders (om_number, asset_id, status, shift, opened_at)
  VALUES ('4.971.998', a_id, 'AGUARDANDO_PECA', 'B',
          (CURRENT_DATE + TIME '18:00' - INTERVAL '1 day')::TIMESTAMPTZ) RETURNING id INTO wo_id;
  SELECT id INTO s_id   FROM public.systems    WHERE name = 'Sistema de Freios';
  SELECT id INTO sub_id FROM public.subsystems WHERE name = 'Sensores' AND system_id = s_id;
  INSERT INTO public.failure_events (work_order_id, system_id, subsystem_id, symptom, presumed_cause, intervention_type, severity)
  VALUES (wo_id, s_id, sub_id, 'Erro de instrumentacao', 'Defeito de fabricacao', 'Substituicao (Replace)', 'Critico');
  INSERT INTO public.maintenance_actions (work_order_id, description, performed_by)
  VALUES (wo_id, 'Aguardando sensor do pedal do freio.', ARRAY['Silvio','Carlos Alexandre']);
  INSERT INTO public.observations (work_order_id, asset_id, type, target, priority, description, suggested_deadline, created_by)
  VALUES (wo_id, a_id, 'PENDENCIA_PCM', 'SUPRIMENTOS', 'CRITICA',
          'Equipamento parado ha mais de 12h aguardando sensor. Priorizar liberacao junto ao fornecedor.',
          CURRENT_DATE + INTERVAL '2 days', 'Carlos Alexandre');

  -- OM 4.972.230 - 7002 - PENDENTE turno C (veio do B)
  SELECT id INTO a_id FROM public.assets WHERE tag = '7002';
  INSERT INTO public.work_orders (om_number, asset_id, status, shift, opened_at, carried_from_shift, carry_note)
  VALUES ('4.972.230', a_id, 'PENDENTE', 'C',
          (CURRENT_DATE + TIME '13:40' - INTERVAL '1 day')::TIMESTAMPTZ, 'B',
          'Iniciada no turno B, deve ser priorizada') RETURNING id INTO wo_id;
  SELECT id INTO s_id   FROM public.systems    WHERE name = 'Motor Diesel';
  SELECT id INTO sub_id FROM public.subsystems WHERE name = 'Sistema de Lubrificacao' AND system_id = s_id;
  INSERT INTO public.failure_events (work_order_id, system_id, subsystem_id, symptom, presumed_cause, intervention_type, severity)
  VALUES (wo_id, s_id, sub_id, 'Superaquecimento', 'Falha de lubrificacao', 'Inspecao (Inspect)', 'Critico');
  INSERT INTO public.maintenance_actions (work_order_id, description, performed_by)
  VALUES (wo_id, 'Alarme de temperatura do oleo. Inspecao em andamento.', ARRAY['Andre Neto']);
  INSERT INTO public.observations (work_order_id, asset_id, type, target, priority, description, created_by)
  VALUES (wo_id, a_id, 'RECOMENDACAO_TROCA', 'ENGENHARIA', 'ALTA',
          'Terceiro alarme de superaquecimento no 7002 em 30 dias. Avaliar troca da bomba de lubrificacao.',
          'Andre Neto');
END $$;

-- =============================================================================
-- FIM. Verifique em Table Editor que aparecem as tabelas em public/archive/analytics.
-- =============================================================================
