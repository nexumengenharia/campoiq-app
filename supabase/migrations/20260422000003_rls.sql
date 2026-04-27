-- =============================================================================
-- CampoIQ — Row Level Security (RLS)
-- =============================================================================
-- Politica basica: usuarios autenticados leem/escrevem tudo.
-- Adapte para multi-tenant quando precisar (ex: usuario so ve sua unidade).
-- =============================================================================

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

-- Policy macro: autenticados tem acesso total ao schema public
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('fleets','assets','systems','subsystems','work_orders',
                        'failure_events','maintenance_actions','observations',
                        'parts_used','photos','field_messages')
  LOOP
    EXECUTE format('CREATE POLICY "auth_read_%I"  ON public.%I FOR SELECT USING (auth.role() = ''authenticated'')', t, t);
    EXECUTE format('CREATE POLICY "auth_write_%I" ON public.%I FOR INSERT WITH CHECK (auth.role() = ''authenticated'')', t, t);
    EXECUTE format('CREATE POLICY "auth_update_%I" ON public.%I FOR UPDATE USING (auth.role() = ''authenticated'')', t, t);
  END LOOP;
END $$;

-- Para permitir acesso anonimo durante o desenvolvimento inicial (REMOVA em producao)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('fleets','assets','systems','subsystems','work_orders',
                        'failure_events','maintenance_actions','observations',
                        'parts_used','photos','field_messages')
  LOOP
    EXECUTE format('CREATE POLICY "anon_read_%I" ON public.%I FOR SELECT USING (true)', t, t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- REALTIME — habilita push para as tabelas que o Kanban observa
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.failure_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.observations;
