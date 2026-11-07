-- Closing a month for the accountant, and reopening it only with a written reason.

create table if not exists public.ledger_period_events (
  id bigint generated always as identity primary key,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  action text not null check (action in ('closed', 'reopened')),
  actor text not null,
  reason text,
  export_path text,
  checks jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ledger_period_events_period_idx on public.ledger_period_events(period, created_at);

drop trigger if exists ledger_period_events_append_only on public.ledger_period_events;
create trigger ledger_period_events_append_only
  before update or delete on public.ledger_period_events
  for each row execute function public.ledger_events_append_only();

alter table public.ledger_period_events enable row level security;
revoke all on public.ledger_period_events from anon, authenticated;
grant select, insert on public.ledger_period_events to service_role;
grant usage, select on sequence public.ledger_period_events_id_seq to service_role;

create or replace function public.ledger_close_period(
  p_period text,
  p_actor text,
  p_checks jsonb,
  p_export_path text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' or nullif(trim(coalesce(p_actor, '')), '') is null then
    raise exception 'Pedido de fecho inválido.' using errcode = 'P0001';
  end if;
  if p_period >= to_char(now() at time zone 'Europe/Lisbon', 'YYYY-MM') then
    raise exception 'O mês % ainda não terminou.', p_period using errcode = 'P0001';
  end if;
  if exists (select 1 from public.bank_transactions where period = p_period and status in ('unreviewed', 'suggested')) then
    raise exception 'Ainda há movimentos por tratar em %.', p_period using errcode = 'P0001';
  end if;

  insert into public.ledger_periods (period, status, closed_by, closed_at, export_path, checks)
  values (p_period, 'closed', p_actor, now(), p_export_path, p_checks)
  on conflict (period) do update
    set status = 'closed', closed_by = excluded.closed_by, closed_at = excluded.closed_at,
        export_path = excluded.export_path, checks = excluded.checks
    where public.ledger_periods.status <> 'closed';
  if not found then
    raise exception 'O mês % já está fechado.', p_period using errcode = 'P0001';
  end if;

  insert into public.ledger_period_events (period, action, actor, export_path, checks)
  values (p_period, 'closed', p_actor, p_export_path, p_checks);
end;
$$;

create or replace function public.ledger_reopen_period(
  p_period text,
  p_actor text,
  p_reason text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Escreva o motivo para reabrir o mês.' using errcode = 'P0001';
  end if;
  update public.ledger_periods
  set status = 'open', closed_by = null, closed_at = null
  where period = p_period and status = 'closed';
  if not found then
    raise exception 'O mês % não está fechado.', p_period using errcode = 'P0001';
  end if;
  insert into public.ledger_period_events (period, action, actor, reason)
  values (p_period, 'reopened', p_actor, trim(p_reason));
end;
$$;

revoke all on function public.ledger_close_period(text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.ledger_reopen_period(text, text, text) from public, anon, authenticated;
grant execute on function public.ledger_close_period(text, text, jsonb, text) to service_role;
grant execute on function public.ledger_reopen_period(text, text, text) to service_role;

-- The accountant's workbook is kept next to the expense documents.
update storage.buckets
set allowed_mime_types = array(
  select distinct unnest(coalesce(allowed_mime_types, '{}') || array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
)
where id = 'ledger-documents';
