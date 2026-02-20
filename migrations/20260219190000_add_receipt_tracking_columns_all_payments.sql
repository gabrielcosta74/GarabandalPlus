-- Ensure all payment sources can be marked as receipt sent/not sent in admin.
-- This migration is idempotent and safe across environments.

alter table public.donations
  add column if not exists invoice_sent_at timestamptz null;

alter table public.pagamentos_quotas
  add column if not exists invoice_sent_at timestamptz null;

alter table public.pilgrimage_payments
  add column if not exists invoice_sent_at timestamptz null;

alter table public.store_orders
  add column if not exists invoice_sent_at timestamptz null;

create index if not exists idx_donations_invoice_sent_at
  on public.donations (invoice_sent_at);

create index if not exists idx_pagamentos_quotas_invoice_sent_at
  on public.pagamentos_quotas (invoice_sent_at);

create index if not exists idx_pilgrimage_payments_invoice_sent_at
  on public.pilgrimage_payments (invoice_sent_at);

create index if not exists idx_store_orders_invoice_sent_at
  on public.store_orders (invoice_sent_at);
