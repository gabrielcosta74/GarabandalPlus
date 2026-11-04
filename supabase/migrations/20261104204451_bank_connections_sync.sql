-- Persistent consent state and a lease so two web/cron processes cannot read
-- the same account at once. Only server-side service_role may access it.
--
-- Cadence (PSD2 allows ~4 reads/day without the account holder present):
--   * automatic (cron at 07:00, 12:00, 17:00 Lisbon): at most one read every
--     3 hours; after a bank rate limit, wait until 07:00 Lisbon the next day.
--   * manual ("Atualizar agora", admin present, sent with the admin's IP so the
--     bank treats it as attended): at most once a minute; if the bank still
--     limits it, manual reads pause until 07:00 the next day.

create table public.bank_connections (
  account_id uuid primary key references public.bank_accounts(id) on delete cascade,
  provider_account_uid text not null,
  session_id text not null,
  valid_until timestamptz,
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  manual_blocked_until timestamptz,
  last_error_code text,
  last_balance numeric(14, 2),
  balance_checked_at timestamptz,
  balance_limited_until timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.bank_connections enable row level security;
revoke all on public.bank_connections from anon, authenticated;
grant select, insert, update on public.bank_connections to service_role;

-- 07:00 Lisbon of the next day, as timestamptz.
create or replace function public.ledger_next_bank_morning()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((date_trunc('day', now() at time zone 'Europe/Lisbon') + interval '1 day 7 hours')
          at time zone 'Europe/Lisbon');
$$;

create or replace function public.ledger_claim_bank_sync(
  p_account_id uuid,
  p_account_uid text,
  p_session_id text,
  p_valid_until timestamptz default null,
  p_manual boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_connection public.bank_connections%rowtype;
  v_token uuid := gen_random_uuid();
  v_from date;
begin
  if p_account_id is null or nullif(trim(p_account_uid), '') is null
     or nullif(trim(p_session_id), '') is null then
    raise exception 'Ligação bancária incompleta.' using errcode = 'P0001';
  end if;

  insert into public.bank_connections (account_id, provider_account_uid, session_id, valid_until)
  values (p_account_id, p_account_uid, p_session_id, p_valid_until)
  on conflict (account_id) do update set
    provider_account_uid = excluded.provider_account_uid,
    session_id = excluded.session_id,
    valid_until = case
      when public.bank_connections.session_id <> excluded.session_id then excluded.valid_until
      else coalesce(excluded.valid_until, public.bank_connections.valid_until) end,
    next_attempt_at = case
      when public.bank_connections.session_id <> excluded.session_id then now()
      else public.bank_connections.next_attempt_at end,
    manual_blocked_until = case
      when public.bank_connections.session_id <> excluded.session_id then null
      else public.bank_connections.manual_blocked_until end,
    last_error_code = case
      when public.bank_connections.session_id <> excluded.session_id then null
      else public.bank_connections.last_error_code end,
    lease_token = case
      when public.bank_connections.session_id <> excluded.session_id then null
      else public.bank_connections.lease_token end,
    lease_until = case
      when public.bank_connections.session_id <> excluded.session_id then null
      else public.bank_connections.lease_until end,
    updated_at = now();

  update public.bank_connections
  set lease_token = v_token,
      lease_until = now() + interval '10 minutes',
      last_attempt_at = now(),
      updated_at = now()
  where account_id = p_account_id
    and (lease_until is null or lease_until < now())
    and (valid_until is null or valid_until > now())
    and case
      when p_manual then
        (manual_blocked_until is null or manual_blocked_until <= now())
        and (last_attempt_at is null or last_attempt_at < now() - interval '1 minute')
      else next_attempt_at <= now()
    end
  returning * into v_connection;

  if not found then
    select * into v_connection from public.bank_connections where account_id = p_account_id;
    return jsonb_build_object(
      'acquired', false,
      'nextAttemptAt', case
        when p_manual then greatest(v_connection.manual_blocked_until, v_connection.last_attempt_at + interval '1 minute', v_connection.lease_until)
        else greatest(v_connection.next_attempt_at, v_connection.lease_until) end,
      'leaseUntil', v_connection.lease_until,
      'validUntil', v_connection.valid_until,
      'manualBlocked', v_connection.manual_blocked_until is not null and v_connection.manual_blocked_until > now(),
      'expired', v_connection.valid_until is not null and v_connection.valid_until <= now());
  end if;

  v_from := greatest(current_date - 89,
    coalesce((v_connection.last_synced_at at time zone 'UTC')::date - 7, current_date - 89));
  return jsonb_build_object('acquired', true, 'leaseToken', v_token,
    'dateFrom', v_from,
    'fetchBalance', v_connection.balance_limited_until is null or v_connection.balance_limited_until <= now(),
    'historyGap', v_connection.last_synced_at is not null
      and v_connection.last_synced_at < now() - interval '89 days');
end;
$$;

create or replace function public.ledger_finish_bank_sync(
  p_account_id uuid,
  p_lease_token uuid,
  p_success boolean,
  p_rate_limited boolean,
  p_balance_rate_limited boolean,
  p_balance numeric,
  p_error_code text default null,
  p_manual boolean default false
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated uuid;
begin
  if p_account_id is null or p_lease_token is null then
    raise exception 'Tentativa bancária inválida.' using errcode = 'P0001';
  end if;
  update public.bank_connections
  set last_synced_at = case when p_success then now() else last_synced_at end,
      -- The automatic schedule only moves on automatic runs, or when the bank
      -- limits us (then nothing should run until tomorrow morning).
      next_attempt_at = case
        when p_rate_limited then greatest(next_attempt_at, public.ledger_next_bank_morning())
        when p_manual then next_attempt_at
        when p_success then now() + interval '3 hours'
        else now() + interval '1 hour' end,
      manual_blocked_until = case
        when p_rate_limited then public.ledger_next_bank_morning()
        else manual_blocked_until end,
      last_error_code = case when p_success then null else left(coalesce(p_error_code, 'BANK_ERROR'), 80) end,
      last_balance = case when p_balance is not null then p_balance else last_balance end,
      balance_checked_at = case when p_balance is not null then now() else balance_checked_at end,
      balance_limited_until = case
        when p_balance_rate_limited then public.ledger_next_bank_morning()
        when p_balance is not null then null
        else balance_limited_until end,
      lease_token = null, lease_until = null, updated_at = now()
  where account_id = p_account_id and lease_token = p_lease_token
  returning account_id into v_updated;
  return v_updated is not null;
end;
$$;

revoke all on function public.ledger_next_bank_morning() from public, anon, authenticated;
revoke all on function public.ledger_claim_bank_sync(uuid, text, text, timestamptz, boolean)
  from public, anon, authenticated;
revoke all on function public.ledger_finish_bank_sync(uuid, uuid, boolean, boolean, boolean, numeric, text, boolean)
  from public, anon, authenticated;
grant execute on function public.ledger_next_bank_morning() to service_role;
grant execute on function public.ledger_claim_bank_sync(uuid, text, text, timestamptz, boolean) to service_role;
grant execute on function public.ledger_finish_bank_sync(uuid, uuid, boolean, boolean, boolean, numeric, text, boolean) to service_role;
