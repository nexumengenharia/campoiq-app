# Deploy passo-a-passo

Este guia leva do zero ao app rodando em produção em ~20 minutos, tudo em tiers gratuitos.

## Pré-requisitos

- Conta GitHub (com este repositório já criado e com o código).
- Conta Supabase (https://supabase.com) — plano Free.
- Conta Vercel (https://vercel.com) — plano Hobby (grátis para uso não comercial/single dev).

## Parte 1 — Supabase

### 1.1 Criar projeto

1. Entre em https://app.supabase.com → **New project**.
2. Nome: `campoiq`. Região: mais próxima de você (ex.: `South America (São Paulo)`).
3. Defina uma senha forte para o banco — **anote-a**, será usada pelo Power BI.
4. Plano: **Free**.
5. Aguarde ~2 min até o projeto provisionar.

### 1.2 Habilitar extensões

Database → **Extensions**:

- `pgcrypto` → ativar (para gerar UUIDs)
- `pg_cron`  → ativar (para o arquivamento automático)

### 1.3 Rodar migrations

SQL Editor → **New query** → cole e rode, em ordem:

1. `supabase/migrations/20260422000001_schema.sql`
2. `supabase/migrations/20260422000002_archive_and_analytics.sql`
3. `supabase/migrations/20260422000003_rls.sql`
4. `supabase/seed.sql`

Valide em **Table Editor** que as tabelas `assets`, `work_orders`, `observations` etc. foram criadas e têm dados.

### 1.4 Agendar o arquivamento

No SQL Editor, execute (uma vez):

```sql
SELECT cron.schedule(
  'campoiq-archive-daily',
  '0 3 * * *',
  $$SELECT public.archive_old_work_orders();$$
);
```

Valide em `SELECT * FROM cron.job;`.

### 1.5 Criar bucket de fotos

Storage → **New bucket**:

- Nome: `photos`
- Public bucket: **ativado**

### 1.6 Capturar credenciais

Settings → **API**:

- `Project URL` → vai em `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → vai em `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role secret` → vai em `SUPABASE_SERVICE_ROLE_KEY` (apenas para cron/scripts — **nunca** exponha no cliente)

## Parte 2 — Vercel

### 2.1 Importar o repositório

1. https://vercel.com → **Add New → Project**.
2. Conecte sua conta GitHub, selecione o repositório `campoiq-app`.
3. Framework Preset: **Next.js** (detectado automaticamente).

### 2.2 Variáveis de ambiente

Em **Environment Variables**, adicione:

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a anon key copiada acima |
| `SUPABASE_SERVICE_ROLE_KEY` | a service role |

### 2.3 Deploy

Clique em **Deploy**. Em ~2 minutos o app estará no ar em `https://campoiq.vercel.app` (ou domínio escolhido).

## Parte 3 — Teste de produção

1. Abra a URL da Vercel no celular.
2. Vá em **Nova Atividade**, registre uma intervenção fictícia.
3. Abra o **Kanban** em outro dispositivo (desktop) — deve aparecer em tempo real (Realtime).
4. Vá em **Relatório**, selecione o turno atual, confira se a atividade consta.
5. Vá em **Observações**, veja se as pendências registradas aparecem no backlog do destinatário correto.

## Parte 4 — Custom domain (opcional)

Vercel → Project → **Domains** → adicione seu domínio (ex.: `campoiq.suaempresa.com.br`). Ajuste o DNS conforme instruído.

## Parte 5 — Monitoramento

- **Supabase → Logs**: queries, erros, auth.
- **Vercel → Deployments**: logs de build e runtime.
- **Supabase → Database → Size**: monitore o uso (limite 500 MB no Free). Com arquivamento ativo, a tabela `public.work_orders` não deve crescer além de poucos MB.

## Troubleshooting

**"Erro 401 ao ler tabelas"** — Verifique que as policies RLS do migration `003_rls.sql` foram criadas. No Free/desenvolvimento, a policy `anon_read` permite leitura sem login.

**"Upload de fotos falhando"** — Confirme que o bucket `photos` existe e está marcado como público.

**"Supabase pausou meu projeto"** — Free tier pausa após 7 dias de inatividade. Veja `docs/KEEPALIVE.md` para configurar ping automático.
