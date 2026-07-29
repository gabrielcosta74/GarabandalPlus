-- Repeated Reduniq callbacks must not create repeated admin notifications.
alter table public.admin_notifications
  add column if not exists dedupe_key text;

create unique index if not exists admin_notifications_dedupe_key_key
  on public.admin_notifications (dedupe_key)
  where dedupe_key is not null;

-- Supports the no-expiry Reduniq reconciliation scan without a full-table scan.
create index if not exists pilgrimage_payments_reduniq_pending_created_idx
  on public.pilgrimage_payments (created_at)
  where status = 'pending' and method like 'reduniq%';

-- A stale FACT.pt worker is ambiguous: the remote API may have accepted the
-- document before the local process stopped. Quarantine it for reconciliation
-- instead of reclaiming it and risking a second fiscal document.
create or replace function public.claim_factpt_documents(
  p_limit integer default 10,
  p_stale_after_seconds integer default 900,
  p_environment text default 'sandbox'
)
returns setof public.factpt_documents
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'p_limit must be between 1 and 25';
  end if;

  if p_stale_after_seconds is null
     or p_stale_after_seconds < 60
     or p_stale_after_seconds > 86400 then
    raise exception 'p_stale_after_seconds must be between 60 and 86400';
  end if;

  if p_environment not in ('sandbox', 'production') then
    raise exception 'Unsupported FACT.pt environment';
  end if;

  update public.factpt_documents as documents
  set
    status = 'failed',
    last_error_code = 'stale_processing_reconciliation_required',
    last_error = concat(
      'O worker terminou durante o processamento. ',
      'Confirmar na FACT.pt se o identifierId já foi emitido antes de repetir.'
    ),
    processing_started_at = null
  where documents.environment = p_environment
    and documents.status = 'processing'
    and (
      documents.processing_started_at is null
      or documents.processing_started_at
        <= pg_catalog.now() - pg_catalog.make_interval(
          secs => p_stale_after_seconds
        )
    );

  return query
  with candidates as (
    select documents.id
    from public.factpt_documents as documents
    where documents.environment = p_environment
      and documents.status = 'pending'
      and documents.next_attempt_at <= pg_catalog.now()
    order by documents.payment_confirmed_at, documents.created_at
    for update skip locked
    limit p_limit
  )
  update public.factpt_documents as documents
  set
    status = 'processing',
    processing_started_at = pg_catalog.now(),
    attempt_count = documents.attempt_count + 1
  from candidates
  where documents.id = candidates.id
  returning documents.*;
end;
$$;

comment on function public.claim_factpt_documents(integer, integer, text) is
  'Claims pending FACT.pt jobs atomically and quarantines stale processing jobs for remote reconciliation.';

revoke all on function public.claim_factpt_documents(integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_factpt_documents(integer, integer, text)
  to service_role;
