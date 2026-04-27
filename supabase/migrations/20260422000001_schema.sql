-- =============================================================================
-- CampoIQ — Schema base (ISO 14224 compliant)
-- =============================================================================
-- Estrutura em 3 camadas:
--   public.*    -> dados ativos (o app le daqui)
--   archive.*   -> historico completo com MTTR/MTBF pre-calculados
--   analytics.* -> views agregadas para Power BI / perfil de perda
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS archive;
CREATE SCHEMA IF NOT EXISTS analytics;

-- -----------------------------------------------------------------------------
-- FROTAS (familias de equipamento)
-- -----------------------------------------------------------------------------
CREATE TABLE public.fleets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,                -- 'caminhao_fe', 'escavadeira'
  name          TEXT NOT NULL,                       -- 'Caminhoes Fora-de-Estrada'
  manufacturer  TEXT,                                -- 'Caterpillar', 'Komatsu'
  model         TEXT,                                -- '797F', '930E'
  icon_key      TEXT,                                -- chave do icone SVG
  tag_range     TEXT,                                -- '7000-7099'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- ATIVOS (equipamentos individuais) — ISO 14224 Taxonomy Level 6
-- -----------------------------------------------------------------------------
CREATE TABLE public.assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag           TEXT UNIQUE NOT NULL,                -- '9401', '7004'
  fleet_id      UUID REFERENCES public.fleets(id),
  description   TEXT,
  criticality   SMALLINT CHECK (criticality BETWEEN 1 AND 5) DEFAULT 3,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assets_tag ON public.assets(tag);
CREATE INDEX idx_assets_fleet ON public.assets(fleet_id);

-- -----------------------------------------------------------------------------
-- TAXONOMIA Sistema / Subsistema (ISO 14224 Annex A)
-- -----------------------------------------------------------------------------
CREATE TABLE public.systems (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,                -- 'Motor Diesel', 'Sistema Hidraulico'
  sort_order    SMALLINT DEFAULT 0
);

CREATE TABLE public.subsystems (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id     UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  UNIQUE(system_id, name)
);

-- -----------------------------------------------------------------------------
-- ORDENS DE MANUTENCAO
-- -----------------------------------------------------------------------------
CREATE TYPE wo_status AS ENUM (
  'PENDENTE',          -- vindo de turno anterior, ainda nao iniciada
  'EM_EXECUCAO',       -- em andamento neste turno
  'CONCLUIDO',         -- finalizada
  'AGUARDANDO_PECA'    -- parada aguardando suprimento
);

CREATE TABLE public.work_orders (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  om_number              TEXT UNIQUE NOT NULL,       -- '4.972.218'
  asset_id               UUID NOT NULL REFERENCES public.assets(id),
  status                 wo_status NOT NULL DEFAULT 'EM_EXECUCAO',
  shift                  CHAR(1) CHECK (shift IN ('A','B','C')),
  opened_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at              TIMESTAMPTZ,
  -- Carry-over entre turnos
  carried_from_shift     CHAR(1),
  carried_from_date      DATE,
  carry_note             TEXT,
  -- Calculado automaticamente no fechamento
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

-- -----------------------------------------------------------------------------
-- EVENTO DE FALHA (ISO 14224 §8 — failure mode/mechanism/cause)
-- -----------------------------------------------------------------------------
CREATE TABLE public.failure_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id          UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  system_id              UUID REFERENCES public.systems(id),
  subsystem_id           UUID REFERENCES public.subsystems(id),
  symptom                TEXT NOT NULL,              -- 'Vazamento externo', 'Perda de potencia'
  presumed_cause         TEXT NOT NULL,              -- 'Torque inadequado / folga'
  intervention_type      TEXT NOT NULL,              -- 'Substituicao (Replace)'
  severity               TEXT CHECK (severity IN ('Incipiente','Degradado','Critico')),
  detection_method       TEXT,                       -- 'Observacao do operador', 'Inspecao'
  root_cause_notes       TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fe_wo ON public.failure_events(work_order_id);
CREATE INDEX idx_fe_system ON public.failure_events(system_id);

-- -----------------------------------------------------------------------------
-- ACOES DE MANUTENCAO (descricao livre + executantes)
-- -----------------------------------------------------------------------------
CREATE TABLE public.maintenance_actions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id          UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  description            TEXT NOT NULL,
  performed_by           TEXT[],                     -- ['Andre Neto','Joelson Ferreira']
  performed_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ma_wo ON public.maintenance_actions(work_order_id);

-- -----------------------------------------------------------------------------
-- OBSERVACOES / PENDENCIAS TECNICAS (substitui 'pecas utilizadas')
-- Gera backlog acionavel para PCM / Inspecao / Engenharia
-- -----------------------------------------------------------------------------
CREATE TYPE observation_type AS ENUM (
  'ARRANJO_TEMPORARIO',     -- fix temporario que precisa ser resolvido depois
  'COMPONENTE_EM_RISCO',    -- peca mostrando sinais de falha iminente
  'RECOMENDACAO_TROCA',     -- sugestao de substituicao preventiva
  'PENDENCIA_PCM',          -- acao para Planejamento e Controle de Manutencao
  'PENDENCIA_INSPECAO',     -- acao para time de Inspecao
  'PENDENCIA_ENGENHARIA',   -- analise de Engenharia de Confiabilidade
  'OBSERVACAO_GERAL'        -- nota geral
);

CREATE TYPE observation_target AS ENUM ('PCM','INSPECAO','ENGENHARIA','MANUTENCAO','OPERACAO','SUPRIMENTOS');
CREATE TYPE observation_priority AS ENUM ('BAIXA','MEDIA','ALTA','CRITICA');
CREATE TYPE observation_status AS ENUM ('ABERTA','EM_ANALISE','RESOLVIDA','CANCELADA');

CREATE TABLE public.observations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id          UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  asset_id               UUID NOT NULL REFERENCES public.assets(id),
  type                   observation_type NOT NULL DEFAULT 'OBSERVACAO_GERAL',
  target                 observation_target NOT NULL DEFAULT 'MANUTENCAO',
  priority               observation_priority NOT NULL DEFAULT 'MEDIA',
  status                 observation_status NOT NULL DEFAULT 'ABERTA',
  description            TEXT NOT NULL,              -- texto livre detalhado
  suggested_deadline     DATE,                       -- prazo sugerido pelo executante
  created_by             TEXT,                       -- nome do executante
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  resolved_at            TIMESTAMPTZ,
  resolved_by            TEXT,
  resolution_notes       TEXT
);

CREATE INDEX idx_obs_status ON public.observations(status);
CREATE INDEX idx_obs_target ON public.observations(target);
CREATE INDEX idx_obs_priority ON public.observations(priority);
CREATE INDEX idx_obs_asset ON public.observations(asset_id);

-- -----------------------------------------------------------------------------
-- PECAS UTILIZADAS (opcional, apenas quando relevante)
-- -----------------------------------------------------------------------------
CREATE TABLE public.parts_used (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id          UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  part_code              TEXT,
  part_name              TEXT NOT NULL,
  quantity               NUMERIC DEFAULT 1,
  unit                   TEXT DEFAULT 'un'
);

-- -----------------------------------------------------------------------------
-- FOTOS (metadados - arquivos ficam no Supabase Storage)
-- -----------------------------------------------------------------------------
CREATE TABLE public.photos (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id          UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  storage_path           TEXT NOT NULL,              -- 'photos/wo-{id}/img-1.jpg'
  caption                TEXT,
  uploaded_by            TEXT,
  uploaded_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photos_wo ON public.photos(work_order_id);

-- -----------------------------------------------------------------------------
-- MENSAGENS DE CAMPO (rastreabilidade da captura - WhatsApp-to-Data)
-- -----------------------------------------------------------------------------
CREATE TABLE public.field_messages (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text               TEXT NOT NULL,
  source                 TEXT DEFAULT 'app',         -- 'app','whatsapp','radio'
  shift                  CHAR(1),
  received_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extracted_json         JSONB,                      -- saida da extracao por LLM
  linked_work_order_ids  UUID[],                     -- OMs geradas a partir desta mensagem
  processed              BOOLEAN DEFAULT FALSE
);

-- -----------------------------------------------------------------------------
-- TRIGGER: updated_at automatico
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wo_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- TRIGGER: ao fechar WO, fecha observacoes orfas relacionadas ao ativo
-- (nao faz nada automaticamente — apenas registra no resolution_notes)
-- -----------------------------------------------------------------------------
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
