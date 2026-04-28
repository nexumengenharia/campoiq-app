# CampoIQ

**Captura de Inteligência de Campo** — WebApp de manutenção industrial com engenharia de confiabilidade integrada.

Registra intervenções em tempo real no chão de fábrica, elimina a perda de dados em grupos de WhatsApp, estrutura as falhas conforme a norma **ISO 14224** e alimenta automaticamente análises de Pareto, MTTR/MTBF e perfil de perda no Power BI.

## Funcionalidades

- **Mapa da frota** em tempo real, agrupado por família, com status colorido por equipamento.
- **Kanban de turno** com três colunas: Pendente (vindos de turnos anteriores), Em Execução, Concluído — mais faixa separada de Aguardando Peça.
- **Registro de atividade** mobile first com classificação Sistema / Subsistema / Sintoma / Causa / Intervenção (ISO 14224).
- **Observações / Pendências técnicas** estruturadas — gera backlog acionável para PCM, Inspeção, Engenharia.
- **Relatório automático de fim de turno** com fotos, exportável em PDF.
- **Realtime** via Supabase — tudo atualiza entre tablets do turno sem refresh.
- **Arquivamento automático** (pg_cron diário) para manter o app leve.
- **Analytics nativo no Postgres** — Power BI conecta direto, sem ETL.

## Stack

- **Next.js 14** (App Router, Server Components) + **TypeScript** + **Tailwind CSS**
- **Supabase** (Postgres + Auth + Storage + Realtime + pg_cron)
- **Vercel** para deploy
- Todos em tiers gratuitos

## Setup local

### 1. Pré-requisitos

- Node.js 18.17+
- Conta no [Supabase](https://supabase.com) (gratuita)
- Conta no [Vercel](https://vercel.com) (gratuita)
- Conta no GitHub

### 2. Criar projeto Supabase

1. Acesse https://app.supabase.com e crie um novo projeto (região mais próxima, plano Free).
2. Anote: **URL do projeto**, **anon key**, **service role key** (Settings → API).
3. No Database → Extensions, ative: `pg_cron`, `pgcrypto`.

### 3. Rodar as migrations

No SQL Editor do Supabase, execute na ordem:

```
supabase/migrations/20260422000001_schema.sql
supabase/migrations/20260422000002_archive_and_analytics.sql
supabase/migrations/20260422000003_rls.sql
supabase/seed.sql
```

Em seguida, no Database → Extensions → pg_cron, descomente e execute o bloco do arquivo `002_archive_and_analytics.sql` que faz `SELECT cron.schedule(...)`.

### 4. Criar bucket de fotos

No Storage → New bucket:

- Nome: `photos`
- Public: ativado (para URLs de leitura diretas — se preferir privado, ajuste as policies)

### 5. Rodar o app

```bash
git clone <seu-repositorio>
cd campoiq-app
npm install
cp .env.local.example .env.local
# preencha .env.local com as credenciais do Supabase
npm run dev
```

Abra http://localhost:3000

## Deploy no Vercel

1. `git push` do seu repositório para o GitHub.
2. No Vercel, **New Project** → importe o repositório.
3. Em **Environment Variables**, adicione as mesmas do `.env.local` (sem o `.example`).
4. Deploy. Pronto.

## Conectar Power BI

1. No Supabase, Settings → Database → **Connection string** (modo `Session pooler`, porta `5432`).
2. No Power BI Desktop: **Obter Dados → PostgreSQL database**.
3. Servidor: `aws-0-<region>.pooler.supabase.com`, Banco: `postgres`.
4. Credenciais: `postgres.<project-ref>` / senha do banco.
5. Navegue até o schema `analytics` e importe as views:
   - `bad_actors` — ranking dos piores ativos por perda
   - `pareto_by_system` — Pareto por sistema
   - `monthly_trend` — tendência mensal
   - `mtbf_by_asset` — MTBF por ativo
   - `open_observations_by_target` — backlog por destinatário

Atualização agendada: configure no Power BI Service com refresh horário.

## Keep-alive (Supabase Free pausa após 7 dias sem uso)

Adicione um Vercel Cron no arquivo `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/keepalive", "schedule": "0 */12 * * *" }
  ]
}
```

E crie a rota `app/api/keepalive/route.ts` que faz um `SELECT 1` no Supabase. O projeto já vem preparado.

## Estrutura

```
campoiq-app/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Mapa da Frota
│   ├── kanban/            # Kanban de Turno
│   ├── nova/              # Nova Atividade
│   ├── observacoes/       # Backlog de observações
│   └── relatorio/         # Relatório de fim de turno
├── components/            # Componentes React
├── lib/
│   ├── supabase/         # Clients client/server
│   ├── types.ts          # Tipos TypeScript
│   └── constants.ts      # Taxonomia ISO 14224
├── supabase/
│   ├── migrations/       # SQL versionado
│   └── seed.sql          # Dados iniciais
└── docs/                 # Documentação adicional
```

## Documentação adicional

- [docs/DEPLOY.md](docs/DEPLOY.md) — passo a passo detalhado de deploy 
- [docs/POWERBI.md](docs/POWERBI.md) — guia de conexão com Power BI e queries prontas
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — diagrama do modelo de dados e explicação ISO 14224

## Licença

Proprietário — uso interno.
