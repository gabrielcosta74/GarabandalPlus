-- Daily bank history for Finanças → Análise, from the 2026 spreadsheet, for the
-- days before the bank feed starts (2026-08-07).
--
-- Kept apart from bank_transactions on purpose: these days are only for charts,
-- so they must not appear in "Por tratar", in monthly closes or in invoice checks.
-- Only server routes read it, so RLS is on with no policies.

create table if not exists public.bank_history_daily (
  day date primary key,
  inflow numeric(14, 2) not null default 0 check (inflow >= 0),
  outflow numeric(14, 2) not null default 0 check (outflow >= 0),
  closing_balance numeric(14, 2) not null,
  source text not null default 'excel_2026',
  created_at timestamptz not null default now()
);

alter table public.bank_history_daily enable row level security;
revoke all on public.bank_history_daily from anon, authenticated;
grant select, insert, update, delete on public.bank_history_daily to service_role;
