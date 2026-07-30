-- Payments confirmed later by the Reduniq reconciliation job must never enter
-- the automatic FACT.pt emission path. The marker is stored on the payment so
-- the database trigger can quarantine the fiscal job atomically with the
-- payment status transition.

alter table public.donations
  add column if not exists factpt_review_required boolean not null default false;

alter table public.pagamentos_quotas
  add column if not exists factpt_review_required boolean not null default false;

alter table public.pilgrimage_payments
  add column if not exists factpt_review_required boolean not null default false;

alter table public.store_orders
  add column if not exists factpt_review_required boolean not null default false;

comment on column public.donations.factpt_review_required is
  'When true, the fiscal document must wait for explicit admin approval.';
comment on column public.pagamentos_quotas.factpt_review_required is
  'When true, the fiscal document must wait for explicit admin approval.';
comment on column public.pilgrimage_payments.factpt_review_required is
  'When true, the fiscal document must wait for explicit admin approval.';
comment on column public.store_orders.factpt_review_required is
  'When true, the fiscal document must wait for explicit admin approval.';

create or replace function factpt_private.enforce_review_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(
       new.source_snapshot ->> 'factpt_review_required',
       'false'
     ) = 'true' then
    new.status := 'awaiting_approval';
  elsif new.status = 'pending'
     and new.approved_at is null
     and exists (
       select 1
       from public.factpt_settings as settings
       where settings.environment = new.environment
         and settings.require_approval
     ) then
    new.status := 'awaiting_approval';
  end if;
  return new;
end;
$$;

comment on function factpt_private.enforce_review_gate() is
  'Quarantines globally gated and per-payment review jobs before FACT.pt workers can claim them.';

revoke all on function factpt_private.enforce_review_gate()
  from public, anon, authenticated;
