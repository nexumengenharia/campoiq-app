# Modelo de Dados

## Visão geral

O schema está organizado em três camadas:

```
public.*      → dados operacionais ativos (últimos 60 dias) — o app lê daqui
archive.*     → histórico completo com campos de tempos externos
analytics.*   → views agregadas para Power BI / engenharia
```

## Diagrama (simplificado)

```
fleets ────< assets ────< work_orders ────< failure_events
                              │                  │
                              │                  └──< (system, subsystem — taxonomia ISO 14224)
                              ├──< maintenance_actions
                              ├──< observations  (backlog PCM/Engenharia/Inspeção)
                              ├──< parts_used
                              └──< photos

systems ────< subsystems      (taxonomia global, compartilhada por todas as frotas)

field_messages                 (histórico bruto de mensagens — WhatsApp-to-Data)
```

## Aderência à ISO 14224

A norma ISO 14224 (Petróleo e Gás — Coleta e intercâmbio de dados de confiabilidade e manutenção) estabelece:

- **Taxonomia hierárquica** de equipamentos (até 9 níveis). Implementamos os níveis 6 (unidade), 7 (subunidade/sistema) e 8 (item mantenível/subsistema).
- **Classificação de falhas** em três dimensões independentes:
  - **Modo (failure mode)** → campo `symptom` (como a falha se manifesta: vazamento, perda de potência...)
  - **Mecanismo (failure mechanism)** → derivado do tipo de intervenção
  - **Causa (failure cause)** → campo `presumed_cause` (por que a falha ocorreu)
- **Severidade** → Crítico / Degradado / Incipiente (campo `severity`)
- **Dados de evento** — todas as datas-chave, executantes, peças usadas.

## Decisões de design relevantes

### 1. Por que Observações são tabela separada, não campo?

A observação "mangueira X próxima de romper" é um **evento que gera ação independente** da OM atual. Ela sobrevive ao fechamento da OM e é rastreada até sua resolução. Como tabela:
- Pode ter seu próprio ciclo de vida (Aberta → Em Análise → Resolvida).
- Pode ser filtrada por destinatário (PCM, Engenharia, Inspeção).
- Pode ter prazo, prioridade e responsável independentes da OM de origem.
- Alimenta o Backlog Acionável sem consultar histórico de OMs.

### 2. Por que `carried_from_shift`?

Sem rastrear a origem do turno, a métrica de "atividades do turno C" fica poluída por OMs iniciadas no turno A. Com `carried_from_shift` preenchido:
- O Kanban pinta badge roxa indicando que não foi "este turno quem começou".
- Relatórios separam claramente o que foi **executado** vs **continuado**.
- Permite calcular "tempo médio que uma OM atravessa turnos" — indicador de eficiência de passagem.

### 3. Por que schema `archive` ao invés de simplesmente deletar?

Dois motivos:
- **Dados para análise de confiabilidade** (MTBF de 1+ ano) exigem histórico completo.
- **Consultas analíticas** (Pareto, tendências) sobre dados antigos não podem congelar o app — o arquivo fica em tabela separada com índices otimizados para leitura em lote (ao invés dos índices otimizados para escrita que a tabela ativa precisa).

### 4. Por que `generated always as ... stored` no MTTR?

Garante consistência: o MTTR nunca sai de sincronia com `opened_at` / `closed_at`. Qualquer `UPDATE` nesses campos recalcula automaticamente, sem precisar de trigger dedicado.

### 5. Por que a taxonomia Sistema → Subsistema como tabelas e não ENUMs?

Flexibilidade. Um mecânico ou PCM pode adicionar um novo subsistema (ex.: "Sistema AdBlue" se a frota for renovada para Euro 6) sem precisar de migration. Com ENUM, qualquer novo valor exige alteração de schema.

## Extensões futuras (hooks deixados prontos)

- `field_messages.extracted_json` — recebe a saída de um parser LLM aplicado em mensagens de WhatsApp.
- `archive.work_orders.external_*` — campos preparados para receber o cruzamento com o sistema de tempos de parada.
- `archive.work_orders.loss_category` — classificação de perda para o perfil operacional.
- `analytics.all_work_orders` — view UNION ALL que torna transparente para o Power BI a existência de duas tabelas (public + archive).

## Convenções

- Todas as tabelas têm `id UUID` gerado por `gen_random_uuid()`.
- Todas as datas são `TIMESTAMPTZ` (sempre com timezone).
- Enums de domínio fechado (status de WO, tipos de observação) são `CREATE TYPE ... AS ENUM`.
- Foreign keys usam `ON DELETE CASCADE` onde faz sentido deletar filho com pai (eventos de falha, ações de manutenção).
- `ON DELETE SET NULL` em `observations.work_order_id` — a observação sobrevive à exclusão da OM, porque ela tem vida própria.
