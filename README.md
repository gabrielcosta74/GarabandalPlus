# Garabandal Payments Web

Mini web app para mover os pagamentos (quotas e donativos) para fora da app mobile. Usa Next.js + Stripe Checkout e grava no Supabase.

## Como usar
1) Copia `.env.example` para `.env.local` e preenche:
   - `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` (Dashboard -> Webhooks).
   - `NEXT_PUBLIC_SITE_URL` com o domínio do site (ou `http://localhost:3000` em dev).
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` para chamadas públicas (se necessário).
   - `SUPABASE_SERVICE_ROLE_KEY` para gravar pagamentos no Supabase (só usado em rotas server, nunca no browser).
   - `RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM` e `STORE_OWNER_EMAIL` para emails automáticos.
2) Instala deps: `cd payments-web && npm install`.
3) Dev: `npm run dev` (abre em http://localhost:3000). Build: `npm run build && npm run start`.
4) Configura webhook Stripe para `POST {SITE_URL}/api/webhook` e subscreve `checkout.session.completed` (e opcionalmente `payment_intent.payment_failed`).

## Fluxo
- `/api/checkout`: cria uma sessão do Stripe Checkout para quota (25€) ou donativo livre.
- Frontend: `page.tsx` (landing), `membership/page.tsx` (quota) e `donations/page.tsx` (doação livre) chamam a rota e redirecionam para o Stripe.
- `/api/webhook`: recebe evento de sucesso e grava no Supabase (`donations` e `pagamentos_quotas`).

## Email notifications (membros)
Criar a tabela para deduplicar envios:

```sql
create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  type text not null,
  reference text null,
  email text null,
  sent_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index if not exists email_notifications_type_reference_key
on public.email_notifications(type, reference);
```

## Cron de lembretes de quota
Criar um cron diario no Vercel para `/api/cron/quota-reminders` (ex.: 08:00 UTC).
Se definires `CRON_SECRET`, configura o cron com header `Authorization: Bearer <CRON_SECRET>`.

## Integração com a app móvel
- Na app Expo, troca os botões de pagar/renovar/doar para abrir `https://seusite/` com query ou token do utilizador.
- A app só lê estado do Supabase (membro, próximas quotas, histórico); o site mantém a escrita/checkout.
