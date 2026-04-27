# Garabandal Payments Web

Mini web app para mover os pagamentos (quotas e donativos) para fora da app mobile. Usa Next.js + Stripe Checkout e grava no Supabase.

## Como usar
1) Copia `.env.example` para `.env.local` e preenche:
   - `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` (Dashboard -> Webhooks).
   - `NEXT_PUBLIC_SITE_URL` com o domínio do site (ou `http://localhost:3000` em dev).
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` para chamadas públicas (se necessário).
   - `SUPABASE_SERVICE_ROLE_KEY` para gravar pagamentos no Supabase (só usado em rotas server, nunca no browser).
   - `RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM` e `STORE_OWNER_EMAIL` para emails automáticos.
   - `NEXT_PUBLIC_POSTHOG_KEY` para analytics públicos da loja/site. Opcional: `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`.
2) Instala deps: `cd payments-web && npm install`.
3) Dev: `npm run dev` (abre em http://localhost:3000). Build: `npm run build && npm run start`.
4) Configura webhook Stripe para `POST {SITE_URL}/api/webhook` e subscreve `checkout.session.completed` (e opcionalmente `payment_intent.payment_failed`).

## Fluxo
- `/api/checkout`: cria uma sessão do Stripe Checkout para quota (25€) ou donativo livre.
- Frontend: `page.tsx` (landing), `membership/page.tsx` (quota) e `donations/page.tsx` (doação livre) chamam a rota e redirecionam para o Stripe.
- `/api/webhook`: recebe evento de sucesso e grava no Supabase (`donations` e `pagamentos_quotas`).

## Analytics público
- A integração usa PostHog quando `NEXT_PUBLIC_POSTHOG_KEY` está configurado.
- Rotas privadas/admin como `/admin`, `/member`, `/account`, `/biblioteca` e `/encomendas` não enviam eventos.
- A loja envia eventos de funil sem dados pessoais: vista de produto, adicionar ao carrinho, passos do checkout, método de pagamento, retorno do pagamento e compra concluída/falhada.

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
Em Railway, cria um serviço separado para cada tarefa agendada. Para a reconciliação Reduniq, usa:

- Start Command: `npm run cron:reduniq-reconcile`
- Cron Schedule: `*/30 * * * *`
- Variáveis: `CRON_SECRET` e `CRON_TARGET_URL=https://<dominio-da-app>`

O comando chama `/api/cron/reduniq-reconcile` com `Authorization: Bearer <CRON_SECRET>` e termina, como o Railway Cron espera.

## Integração com a app móvel
- Na app Expo, troca os botões de pagar/renovar/doar para abrir `https://seusite/` com query ou token do utilizador.
- A app só lê estado do Supabase (membro, próximas quotas, histórico); o site mantém a escrita/checkout.
