-- Hardening for payment idempotency.
-- Run in Supabase SQL Editor.

-- 1) Guard rails: do not proceed if there are duplicates.
do $$
begin
  if exists (
    select 1
    from public.donations
    where external_reference is not null
    group by external_reference
    having count(*) > 1
  ) then
    raise exception 'Duplicate donations.external_reference found. Resolve duplicates before applying unique index.';
  end if;

  if exists (
    select 1
    from public.donations
    where payment_intent_id is not null
    group by payment_intent_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate donations.payment_intent_id found. Resolve duplicates before applying unique index.';
  end if;

  if exists (
    select 1
    from public.pagamentos_quotas
    where external_reference is not null
    group by external_reference
    having count(*) > 1
  ) then
    raise exception 'Duplicate pagamentos_quotas.external_reference found. Resolve duplicates before applying unique index.';
  end if;

  if exists (
    select 1
    from public.pagamentos_quotas
    where payment_intent_id is not null
    group by payment_intent_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate pagamentos_quotas.payment_intent_id found. Resolve duplicates before applying unique index.';
  end if;
end $$;

-- 2) Unique indexes for idempotency keys.
create unique index if not exists donations_external_reference_uniq
  on public.donations (external_reference)
  where external_reference is not null;

create unique index if not exists donations_payment_intent_id_uniq
  on public.donations (payment_intent_id)
  where payment_intent_id is not null;

create unique index if not exists pagamentos_quotas_external_reference_uniq
  on public.pagamentos_quotas (external_reference)
  where external_reference is not null;

create unique index if not exists pagamentos_quotas_payment_intent_id_uniq
  on public.pagamentos_quotas (payment_intent_id)
  where payment_intent_id is not null;

-- 3) Helpful non-unique indexes for lookups used by confirm/result routes.
create index if not exists donations_status_idx
  on public.donations (status);

create index if not exists pagamentos_quotas_estado_idx
  on public.pagamentos_quotas (estado);
