-- =============================================================================
-- CampoIQ — Dados iniciais (taxonomia ISO 14224 + frota exemplo + 6 atividades)
-- Execute APOS as migrations.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) FROTAS
-- -----------------------------------------------------------------------------
INSERT INTO public.fleets (code, name, manufacturer, model, icon_key, tag_range) VALUES
  ('caminhao_fe',     'Caminhoes Fora-de-Estrada', 'Caterpillar', '797F', 'caminhao_fe', '7000-7099'),
  ('escavadeira',     'Escavadeiras Hidraulicas',  'Komatsu',     'PC2000-11', 'escavadeira', '8500-8599'),
  ('trator_esteira',  'Tratores de Esteiras',      'Caterpillar', 'D11T', 'trator_esteira', '8800-8899'),
  ('pa_carregadeira', 'Pas Carregadeiras',         'Caterpillar', '994K', 'pa_carregadeira', '9400-9499'),
  ('perfuratriz',     'Perfuratrizes',             'Atlas Copco', 'Pit Viper', 'perfuratriz', '6000-6099');

-- -----------------------------------------------------------------------------
-- 2) TAXONOMIA Sistema / Subsistema (ISO 14224 Annex A)
-- -----------------------------------------------------------------------------
INSERT INTO public.systems (name, sort_order) VALUES
  ('Motor Diesel',       1),
  ('Transmissao',        2),
  ('Sistema Hidraulico', 3),
  ('Sistema de Direcao', 4),
  ('Sistema de Freios',  5),
  ('Sistema Eletrico',   6),
  ('Estrutural/Chassi',  7),
  ('Pneus/Rodagem',      8);

INSERT INTO public.subsystems (system_id, name)
SELECT s.id, sub.name FROM public.systems s
JOIN (VALUES
  ('Motor Diesel',       'Bloco/Cabecote'),
  ('Motor Diesel',       'Sistema de Combustivel'),
  ('Motor Diesel',       'Sistema de Lubrificacao'),
  ('Motor Diesel',       'Sistema de Arrefecimento'),
  ('Motor Diesel',       'Turbo/Admissao'),
  ('Motor Diesel',       'Sistema de Escape'),
  ('Transmissao',        'Conversor de Torque'),
  ('Transmissao',        'Caixa de Marchas'),
  ('Transmissao',        'Eixos Diferenciais'),
  ('Transmissao',        'Comando Final'),
  ('Sistema Hidraulico', 'Grupo Principal'),
  ('Sistema Hidraulico', 'Bomba Hidraulica'),
  ('Sistema Hidraulico', 'Cilindros'),
  ('Sistema Hidraulico', 'Mangueiras/Linhas'),
  ('Sistema Hidraulico', 'Valvulas de Controle'),
  ('Sistema Hidraulico', 'Resfriador'),
  ('Sistema de Direcao', 'Bomba de Direcao'),
  ('Sistema de Direcao', 'Cilindros de Direcao'),
  ('Sistema de Direcao', 'Valvula Orbitrol'),
  ('Sistema de Direcao', 'Mangueiras'),
  ('Sistema de Freios',  'Sistema de Servico'),
  ('Sistema de Freios',  'Freio de Estacionamento'),
  ('Sistema de Freios',  'Retardador'),
  ('Sistema de Freios',  'Sensores'),
  ('Sistema Eletrico',   'Alternador/Partida'),
  ('Sistema Eletrico',   'Sensores'),
  ('Sistema Eletrico',   'Chicote/Conectores'),
  ('Sistema Eletrico',   'Iluminacao'),
  ('Sistema Eletrico',   'Painel/ECU'),
  ('Estrutural/Chassi',  'Chassi Principal'),
  ('Estrutural/Chassi',  'Cacamba/Concha'),
  ('Estrutural/Chassi',  'Mancais/Pinos'),
  ('Estrutural/Chassi',  'Articulacao'),
  ('Pneus/Rodagem',      'Pneus'),
  ('Pneus/Rodagem',      'Rodas/Aros'),
  ('Pneus/Rodagem',      'Cubo de Roda')
) AS sub(system_name, name) ON s.name = sub.system_name;

-- -----------------------------------------------------------------------------
-- 3) ATIVOS (frota exemplo — substitua pelos seus tags reais)
-- -----------------------------------------------------------------------------
INSERT INTO public.assets (tag, fleet_id, description, criticality)
SELECT tag, f.id, desc_, crit FROM public.fleets f
JOIN (VALUES
  ('7001', 'caminhao_fe',     'Caminhao Fora-de-Estrada', 5),
  ('7002', 'caminhao_fe',     'Caminhao Fora-de-Estrada', 5),
  ('7004', 'caminhao_fe',     'Caminhao Fora-de-Estrada', 5),
  ('8501', 'escavadeira',     'Escavadeira Hidraulica',   5),
  ('8502', 'escavadeira',     'Escavadeira Hidraulica',   5),
  ('8503', 'escavadeira',     'Escavadeira Hidraulica',   5),
  ('8801', 'trator_esteira',  'Trator de Esteiras',       4),
  ('8802', 'trator_esteira',  'Trator de Esteiras',       4),
  ('9401', 'pa_carregadeira', 'Pa Carregadeira',          5),
  ('9402', 'pa_carregadeira', 'Pa Carregadeira',          5),
  ('9403', 'pa_carregadeira', 'Pa Carregadeira',          5),
  ('9404', 'pa_carregadeira', 'Pa Carregadeira',          5)
) AS a(tag, fleet_code, desc_, crit) ON f.code = a.fleet_code;

-- -----------------------------------------------------------------------------
-- 4) ATIVIDADES EXEMPLO (6 OMs extraidas das mensagens de campo reais)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  wo_id UUID;
  a_id UUID;
  s_id UUID;
  sub_id UUID;
BEGIN
  -- OM 4.972.218 - Ativo 9401 (concluida turno A)
  SELECT id INTO a_id FROM public.assets WHERE tag = '9401';
  INSERT INTO public.work_orders (om_number, asset_id, status, shift, opened_at, closed_at)
  VALUES ('4.972.218', a_id, 'CONCLUIDO', 'A',
          (CURRENT_DATE + TIME '06:40')::TIMESTAMPTZ,
          (CURRENT_DATE + TIME '08:05')::TIMESTAMPTZ)
  RETURNING id INTO wo_id;

  SELECT id INTO s_id   FROM public.systems    WHERE name = 'Estrutural/Chassi';
  SELECT id INTO sub_id FROM public.subsystems WHERE name = 'Mancais/Pinos' AND system_id = s_id;
  INSERT INTO public.failure_events (work_order_id, system_id, subsystem_id, symptom, presumed_cause, intervention_type, severity)
  VALUES (wo_id, s_id, sub_id, 'Folga mecanica', 'Torque inadequado / folga', 'Ajuste / Reaperto (Adjust)', 'Degradado');
  INSERT INTO public.maintenance_actions (work_order_id, description, performed_by)
  VALUES (wo_id, 'Parafusos do mancal do pino da concha folgados. Feita limpeza, aperto dos parafusos e liberacao para operacao.',
          ARRAY['Andre Neto','Joelson Ferreira','Elberson Sousa','Kleiton Souza']);

  -- OM 4.972.221 - Ativo 9403 (concluida turno A)
  SELECT id INTO a_id FROM public.assets WHERE tag = '9403';
  INSERT INTO public.work_orders (om_number, asset_id, status, shift, opened_at, closed_at)
  VALUES ('4.972.221', a_id, 'CONCLUIDO', 'A',
          (CURRENT_DATE + TIME '07:15')::TIMESTAMPTZ,
          (CURRENT_DATE + TIME '08:20')::TIMESTAMPTZ)
  RETURNING id INTO wo_id;

  SELECT id INTO s_id   FROM public.systems    WHERE name = 'Motor Diesel';
  SELECT id INTO sub_id FROM public.subsystems WHERE name = 'Sistema de Combustivel' AND system_id = s_id;
  INSERT INTO public.failure_events (work_order_id, system_id, subsystem_id, symptom, presumed_cause, intervention_type, severity)
  VALUES (wo_id, s_id, sub_id, 'Perda de potencia', 'Falha de montagem/instalacao', 'Reparo (Repair)', 'Degradado');
  INSERT INTO public.maintenance_actions (work_order_id, description, performed_by)
  VALUES (wo_id, 'Sensor do filtro de combustivel nao estava plugado. Feita reconexao, troca do filtro, lubrificacao auto e teste funcional. Equipamento liberado.',
          ARRAY['Andre Neto','Joelson Ferreira','Elberson Sousa','Kleiton Souza']);
  INSERT INTO public.parts_used (work_order_id, part_name, quantity, unit)
  VALUES (wo_id, 'Filtro de combustivel', 1, 'un');

  -- OM 4.972.151 - Ativo 8502 (concluida turno C)
  SELECT id INTO a_id FROM public.assets WHERE tag = '8502';
  INSERT INTO public.work_orders (om_number, asset_id, status, shift, opened_at, closed_at)
  VALUES ('4.972.151', a_id, 'CONCLUIDO', 'C',
          (CURRENT_DATE + TIME '23:45' - INTERVAL '1 day')::TIMESTAMPTZ,
          (CURRENT_DATE + TIME '00:28')::TIMESTAMPTZ)
  RETURNING id INTO wo_id;

  SELECT id INTO s_id   FROM public.systems    WHERE name = 'Sistema Hidraulico';
  SELECT id INTO sub_id FROM public.subsystems WHERE name = 'Mangueiras/Linhas' AND system_id = s_id;
  INSERT INTO public.failure_events (work_order_id, system_id, subsystem_id, symptom, presumed_cause, intervention_type, severity)
  VALUES (wo_id, s_id, sub_id, 'Vazamento externo', 'Torque inadequado / folga', 'Ajuste / Reaperto (Adjust)', 'Degradado');
  INSERT INTO public.maintenance_actions (work_order_id, description, performed_by)
  VALUES (wo_id, 'Mangueira piloto do grupo hidraulico folgada. Reaperto e complemento de fluido hidraulico. Liberado pela mecanica.',
          ARRAY['Silvio','Carlos Alexandre']);
  -- Observacao prospectiva (mangueira perto de romper)
  INSERT INTO public.observations (work_order_id, asset_id, type, target, priority, description, suggested_deadline, created_by)
  VALUES (wo_id, a_id, 'COMPONENTE_EM_RISCO', 'INSPECAO', 'ALTA',
          'Mangueira piloto do grupo hidraulico apresenta desgaste visivel na extremidade da conexao. Sugestao: programar substituicao preventiva na proxima parada de manutencao.',
          CURRENT_DATE + INTERVAL '15 days', 'Silvio');

  -- OM 4.972.225 - Ativo 7004 (em execucao, veio do turno A)
  SELECT id INTO a_id FROM public.assets WHERE tag = '7004';
  INSERT INTO public.work_orders (om_number, asset_id, status, shift, opened_at, carried_from_shift, carry_note)
  VALUES ('4.972.225', a_id, 'EM_EXECUCAO', 'C',
          (CURRENT_DATE + TIME '00:15')::TIMESTAMPTZ, 'A',
          'Turno seguinte pega o cilindro da 7004 e leva para o Aviso')
  RETURNING id INTO wo_id;

  SELECT id INTO s_id   FROM public.systems    WHERE name = 'Sistema de Direcao';
  SELECT id INTO sub_id FROM public.subsystems WHERE name = 'Cilindros de Direcao' AND system_id = s_id;
  INSERT INTO public.failure_events (work_order_id, system_id, subsystem_id, symptom, presumed_cause, intervention_type, severity)
  VALUES (wo_id, s_id, sub_id, 'Vazamento externo', 'Desgaste por uso', 'Substituicao (Replace)', 'Critico');
  INSERT INTO public.maintenance_actions (work_order_id, description, performed_by)
  VALUES (wo_id, 'Cilindro disponivel na oficina MB (L/E). Fazer reversao dos cilindros L/D->L/E e L/E->L/D. Iniciado reversao no final do turno A.',
          ARRAY['Silvio','Carlos Alexandre']);
  INSERT INTO public.observations (work_order_id, asset_id, type, target, priority, description, created_by)
  VALUES (wo_id, a_id, 'ARRANJO_TEMPORARIO', 'PCM', 'ALTA',
          'Reversao de cilindros L/D<->L/E e uma solucao temporaria. Necessario programar substituicao definitiva dos dois cilindros com pecas novas. Prazo para PCM: solicitar cotacao e previsao de chegada.',
          'Silvio');

  -- OM 4.971.998 - Ativo 8801 (aguardando peca, turno B)
  SELECT id INTO a_id FROM public.assets WHERE tag = '8801';
  INSERT INTO public.work_orders (om_number, asset_id, status, shift, opened_at)
  VALUES ('4.971.998', a_id, 'AGUARDANDO_PECA', 'B',
          (CURRENT_DATE + TIME '18:00' - INTERVAL '1 day')::TIMESTAMPTZ)
  RETURNING id INTO wo_id;

  SELECT id INTO s_id   FROM public.systems    WHERE name = 'Sistema de Freios';
  SELECT id INTO sub_id FROM public.subsystems WHERE name = 'Sensores' AND system_id = s_id;
  INSERT INTO public.failure_events (work_order_id, system_id, subsystem_id, symptom, presumed_cause, intervention_type, severity)
  VALUES (wo_id, s_id, sub_id, 'Erro de instrumentacao', 'Defeito de fabricacao', 'Substituicao (Replace)', 'Critico');
  INSERT INTO public.maintenance_actions (work_order_id, description, performed_by)
  VALUES (wo_id, 'Aguardando sensor do pedal do freio. Maquina parada no patio da manutencao.',
          ARRAY['Silvio','Carlos Alexandre']);
  INSERT INTO public.observations (work_order_id, asset_id, type, target, priority, description, suggested_deadline, created_by)
  VALUES (wo_id, a_id, 'PENDENCIA_PCM', 'SUPRIMENTOS', 'CRITICA',
          'Sensor do pedal do freio com previsao de chegada aguardando confirmacao. Equipamento parado ha mais de 12h. Priorizar liberacao da peca junto ao fornecedor.',
          CURRENT_DATE + INTERVAL '2 days', 'Carlos Alexandre');

  -- OM 4.972.230 - Ativo 7002 (pendente, veio do turno B)
  SELECT id INTO a_id FROM public.assets WHERE tag = '7002';
  INSERT INTO public.work_orders (om_number, asset_id, status, shift, opened_at, carried_from_shift, carry_note)
  VALUES ('4.972.230', a_id, 'PENDENTE', 'C',
          (CURRENT_DATE + TIME '13:40' - INTERVAL '1 day')::TIMESTAMPTZ, 'B',
          'Iniciada no turno B, nao foi concluida - deve ser priorizada')
  RETURNING id INTO wo_id;

  SELECT id INTO s_id   FROM public.systems    WHERE name = 'Motor Diesel';
  SELECT id INTO sub_id FROM public.subsystems WHERE name = 'Sistema de Lubrificacao' AND system_id = s_id;
  INSERT INTO public.failure_events (work_order_id, system_id, subsystem_id, symptom, presumed_cause, intervention_type, severity)
  VALUES (wo_id, s_id, sub_id, 'Superaquecimento', 'Falha de lubrificacao', 'Inspecao (Inspect)', 'Critico');
  INSERT INTO public.maintenance_actions (work_order_id, description, performed_by)
  VALUES (wo_id, 'Alarme de temperatura do oleo. Inspecao em andamento - verificando bomba de lubrificacao e termostato.',
          ARRAY['Andre Neto']);
  INSERT INTO public.observations (work_order_id, asset_id, type, target, priority, description, created_by)
  VALUES (wo_id, a_id, 'RECOMENDACAO_TROCA', 'ENGENHARIA', 'ALTA',
          'Sera necessario avaliar troca da bomba de lubrificacao do motor. Este e o terceiro alarme de superaquecimento no 7002 em 30 dias. Solicita analise de engenharia para definir se e trocar bomba ou investigar a montante.',
          'Andre Neto');
END $$;
