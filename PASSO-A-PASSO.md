# CampoIQ — Passo a Passo do Deploy (zero custo)

Siga na ordem. Total ~25 min na primeira vez.

---

## Etapa 1 — Supabase (banco de dados)

1. Abra **https://supabase.com** e clique em **Start your project** (login com GitHub é o mais rápido).
2. Clique em **New Project**:
   - Name: `campoiq`
   - Database Password: **anote essa senha** (vai usar no Power BI depois)
   - Region: `South America (São Paulo)`
   - Plan: **Free** → Create new project
3. Aguarde ~2 min (status vira "Healthy").
4. Menu esquerdo → **SQL Editor** → **New query**.
5. Abra o arquivo `supabase/ALL-IN-ONE.sql` no Bloco de Notas, **Ctrl+A, Ctrl+C**, cole no SQL Editor, clique em **RUN** (verde).
   - Deve aparecer "Success. No rows returned" ou similar.
6. Menu esquerdo → **Storage** → **New bucket**:
   - Name: `photos`
   - Public bucket: **marque essa caixa** → Create
7. Menu esquerdo → **Settings** → **API**. Copie e guarde em um bloco de notas:
   - **Project URL** (termina em `.supabase.co`)
   - **anon public** (chave longa)
   - **service_role** (clique em "Reveal", chave longa)

---

## Etapa 2 — Local (sua máquina)

1. Abra a pasta `C:\Users\NILTON TRADER\Downloads\campoiq-app` no Explorer.
2. **Clique duplo em `setup.bat`**. Ele:
   - verifica Node.js e Git,
   - cria `.env.local`,
   - instala as dependências (~3 min),
   - inicia o repo Git.
3. Abra `.env.local` no Bloco de Notas e preencha com o que copiou do Supabase:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
   ```
   Salve e feche.
4. **Clique duplo em `dev.bat`** → abre o servidor local.
5. No navegador: **http://localhost:3000** — deve carregar o Mapa da Frota com os 12 equipamentos e 6 atividades de exemplo.
6. Navegue: Mapa → Kanban → Nova Atividade → Observações → Relatório. Teste criar uma OM nova.
7. Se estiver tudo ok, feche o `dev.bat` (Ctrl+C).

---

## Etapa 3 — GitHub (versionamento)

1. Acesse **https://github.com/new** (logado):
   - Repository name: `campoiq-app`
   - **Private** (recomendado)
   - **NÃO marque** "Add README", "Add .gitignore" ou "Add license" → Create repository
2. Copie a URL que aparece (ex: `https://github.com/seu-user/campoiq-app.git`).
3. Na pasta do projeto, **clique duplo em `push.bat`**.
4. Cole a URL quando pedir. Mensagem de commit: aperte ENTER (usa "atualizacao") ou digite algo.
5. Se pedir login: use seu usuário GitHub. Se der erro de senha, crie um **Personal Access Token** em https://github.com/settings/tokens (scopes: `repo`) e use como senha.

---

## Etapa 4 — Vercel (hospedagem)

1. Acesse **https://vercel.com/new** (login com GitHub).
2. **Import Git Repository** → escolha `campoiq-app` → **Import**.
3. Em **Environment Variables**, adicione as **3 mesmas variáveis** do `.env.local`:
   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | (do Supabase) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (do Supabase) |
   | `SUPABASE_SERVICE_ROLE_KEY` | (do Supabase) |
4. Clique em **Deploy** → aguarde ~2 min.
5. Vai aparecer uma URL tipo `campoiq-app-xxx.vercel.app`. **Esse é o app rodando em produção.** Abra no celular pra testar.
6. (Opcional) Settings → Domains → adicione um domínio seu se quiser.

---

## Etapa 5 — Keep-alive (anti-pausa do Supabase grátis)

Já vem configurado no `vercel.json`. Ao fazer o deploy, a Vercel detecta o cron automaticamente. Confirme em **Vercel Dashboard → Project → Settings → Cron Jobs** — deve mostrar `/api/keepalive` agendado a cada 12h.

---

## Etapa 6 — Power BI (análises)

1. No Supabase → Settings → Database → **Connection info**. Copie host, user e porta (**5432 Session pooler**).
2. Abra Power BI Desktop → **Obter Dados** → **PostgreSQL database**.
3. Servidor: `aws-0-<região>.pooler.supabase.com:5432` / Banco: `postgres`.
4. Usuário: `postgres.<ref-do-projeto>` / Senha: a que você definiu na criação do Supabase.
5. Expanda o schema **analytics** → marque as 6 views → **Carregar**.
6. Pronto: pode montar Pareto, Bad Actors, MTBF etc. DAX prontos em `docs/POWERBI.md`.

---

## Etapa 7 — Alterações futuras (fluxo de trabalho contínuo)

Toda vez que mudar algo no código:

1. Edite os arquivos localmente.
2. Teste com `dev.bat`.
3. Quando estiver ok: **clique duplo em `push.bat`** — commit + push automático.
4. A Vercel detecta o push e faz o deploy sozinha em ~1 min.

---

## Se algo der errado

| Sintoma | Solução |
|---|---|
| `setup.bat` diz "Node.js não encontrado" | Instale Node LTS em https://nodejs.org e rode o setup de novo |
| `dev.bat` abre e fecha rápido | Verifique se `.env.local` tem as 3 chaves preenchidas |
| App local mostra erro de banco | Verifique no Supabase (Table Editor) se as tabelas existem em `public` |
| `push.bat` dá erro de autenticação | Crie um Personal Access Token no GitHub e use como senha |
| Vercel build falha | Nas envs do Vercel, confirme as 3 variáveis do Supabase |
| Mapa vem vazio | O seed ainda não rodou — volte ao SQL Editor e execute `ALL-IN-ONE.sql` |

---

**Documentação técnica adicional** (se precisar): `docs/DEPLOY.md`, `docs/POWERBI.md`, `docs/DATA-MODEL.md`, `docs/KEEPALIVE.md`, `README.md`.
