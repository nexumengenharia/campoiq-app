# Power BI — Guia de Conexão

O CampoIQ expõe views analíticas no schema `analytics` otimizadas para consumo direto pelo Power BI. Não precisa de ETL, CSV, webhook ou ferramenta intermediária.

## Conexão direta ao Postgres

### 1. Credenciais (obter no Supabase)

Settings → **Database** → **Connection info**:

- **Host**: `aws-0-<region>.pooler.supabase.com`
- **Database**: `postgres`
- **Port**: `5432` (Session pooler — ideal para Power BI refresh)
- **User**: `postgres.<project-ref>`
- **Password**: a senha definida na criação do projeto

### 2. No Power BI Desktop

1. **Obter Dados** → **PostgreSQL database**.
2. Servidor: `aws-0-<region>.pooler.supabase.com:5432`
3. Banco de dados: `postgres`
4. Modo de conectividade: **Importar** (recomendado) ou DirectQuery.
5. Credenciais: Database → `postgres.<project-ref>` / senha.
6. Ao abrir o Navegador, expanda o schema `analytics`.

### 3. Views prontas

| View | O que mostra | Uso típico |
|---|---|---|
| `analytics.bad_actors` | Ranking de ativos por tempo total de parada (90 dias) | Gráfico de barras horizontais — top 10 bad actors |
| `analytics.pareto_by_system` | Falhas por sistema com % acumulado | Pareto clássico — onde concentrar a ação |
| `analytics.monthly_trend` | Falhas/MTTR por sistema por mês (12 meses) | Gráfico de linha — tendência de degradação |
| `analytics.mtbf_by_asset` | MTBF calculado por ativo | Identificar ativos degradando (MTBF caindo) |
| `analytics.open_observations_by_target` | Backlog aberto agrupado por destinatário | Dashboard operacional — carga de trabalho PCM/Engenharia |
| `analytics.all_work_orders` | União de OMs ativas + arquivadas | Base para análises customizadas |

### 4. Medidas DAX sugeridas

```dax
Downtime Total (h) =
DIVIDE(SUM('bad_actors'[total_downtime_min]), 60, 0)

MTTR Medio (h) =
DIVIDE(AVERAGE('bad_actors'[avg_mttr_min]), 60, 0)

% Pareto Acumulado =
VAR RankAtual =
    RANKX(ALL('pareto_by_system'), 'pareto_by_system'[failure_count], , DESC)
VAR SomaAcumulada =
    CALCULATE(
        SUM('pareto_by_system'[pct_of_total]),
        FILTER(ALL('pareto_by_system'),
            RANKX(ALL('pareto_by_system'), 'pareto_by_system'[failure_count], , DESC) <= RankAtual)
    )
RETURN SomaAcumulada
```

### 5. Refresh automático

No Power BI Service → **Datasets** → Agendar atualização:

- Frequência: horário (máximo no plano gratuito é 8x/dia; no Pro é 48x/dia).
- Gateway: não necessário, conexão é direta à internet.

### 6. Cruzamento com o sistema externo de tempos

Quando o sistema externo (SAP PM, Dinamo, etc.) for integrado, ele preenche os campos de `archive.work_orders`:

- `external_stop_at`
- `external_release_at`
- `external_duration_min`
- `loss_category`

A view `analytics.all_work_orders` já combina esses dados. No Power BI você passa a ter duas métricas de duração:

- `mttr_minutes` — o tempo capturado pelo CampoIQ (abertura → fechamento do registro)
- `external_duration_min` — o tempo real de parada operacional (do sistema de produção)

A diferença entre as duas é o indicador de **eficiência de captura** e de **tempo de preparação** vs **tempo de reparo efetivo**.

## Queries SQL diretas (para explorar no Supabase SQL Editor)

### Top 10 bad actors

```sql
SELECT tag, fleet, failure_count, avg_mttr_min, total_downtime_hr
FROM analytics.bad_actors
LIMIT 10;
```

### Pareto por sistema com % acumulado

```sql
SELECT
  system,
  failure_count,
  pct_of_total,
  SUM(pct_of_total) OVER (ORDER BY failure_count DESC) AS pct_acumulado
FROM analytics.pareto_by_system;
```

### Backlog crítico para PCM e Engenharia

```sql
SELECT target, priority, open_count, overdue_count, earliest_deadline
FROM analytics.open_observations_by_target
WHERE target IN ('PCM','ENGENHARIA')
ORDER BY priority;
```

### Ativos com MTBF caindo (comparando últimos 90d vs 365d)

```sql
WITH recent AS (
  SELECT asset_id, COUNT(*) AS n90
  FROM public.work_orders
  WHERE opened_at >= NOW() - INTERVAL '90 days' AND status = 'CONCLUIDO'
  GROUP BY asset_id
)
SELECT a.tag, m.mtbf_hours, r.n90 AS failures_last_90d
FROM analytics.mtbf_by_asset m
JOIN public.assets a ON a.tag = m.tag
LEFT JOIN recent r ON r.asset_id = a.id
ORDER BY m.mtbf_hours ASC NULLS LAST
LIMIT 20;
```

## Segurança

Para ambiente corporativo, considere criar um usuário **read-only** exclusivo para o Power BI:

```sql
CREATE ROLE powerbi_reader WITH LOGIN PASSWORD 'senha-forte-aqui';
GRANT CONNECT ON DATABASE postgres TO powerbi_reader;
GRANT USAGE ON SCHEMA analytics TO powerbi_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO powerbi_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO powerbi_reader;
```

Use esse usuário no Power BI — ele só lê analytics, nunca escreve em nada.
