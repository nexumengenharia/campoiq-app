# Keep-Alive — manter o Supabase Free Tier ativo

O plano gratuito do Supabase **pausa** projetos após 7 dias sem atividade. Para um app de produção, isso é um problema — a primeira requisição após a pausa demora ~30s (o projeto precisa "acordar").

Solução: ping automático a cada 12h via Vercel Cron.

## 1. Criar endpoint de ping

Arquivo: `app/api/keepalive/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await supabase.from('fleets').select('id').limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
}
```

## 2. Configurar Vercel Cron

Arquivo: `vercel.json` (na raiz do projeto)

```json
{
  "crons": [
    { "path": "/api/keepalive", "schedule": "0 */12 * * *" }
  ]
}
```

Isso executa o endpoint a cada 12 horas (00:00 e 12:00 UTC).

## 3. Commit e deploy

Após o push, o Vercel detecta o `vercel.json` e agenda o cron automaticamente. Valide em **Vercel Dashboard → Project → Settings → Cron Jobs**.

## 4. Alternativa sem cron da Vercel (plano Hobby tem limitações)

Use um serviço gratuito externo:

- https://cron-job.org — agende `GET https://<seu-app>.vercel.app/api/keepalive` a cada 6 horas.
- UptimeRobot — monitor a cada 5min também serve como keep-alive e ainda te alerta se o app cair.

## Observação importante

O ping faz **um** query leve (`SELECT id FROM fleets LIMIT 1`) — consumo desprezível do limite de 500 MB de transferência mensal do Supabase Free.
