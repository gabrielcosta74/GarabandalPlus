-- Extend the validated FACT.pt 2026D production path to direct donations.
-- Activation remains off until the matching Railway deployment is verified;
-- donations_go_live_at is a separate cutoff so historical donations never
-- enter the fiscal queue.

alter table public.factpt_settings
  add column if not exists production_donations_enabled boolean not null default false,
  add column if not exists donations_go_live_at timestamp with time zone;

alter table public.factpt_settings
  drop constraint if exists factpt_settings_donations_cutoff_guard;

alter table public.factpt_settings
  add constraint factpt_settings_donations_cutoff_guard
  check (
    not production_donations_enabled
    or donations_go_live_at is not null
  );

comment on column public.factpt_settings.production_donations_enabled is
  'Enables new direct donations from public.donations in the production FACT.pt queue.';
comment on column public.factpt_settings.donations_go_live_at is
  'Independent production cutoff for direct donations; existing historical rows are never backfilled.';
comment on column public.factpt_settings.production_pilgrimages_only is
  'Enables pilgrimage_payments as an automatic production FACT.pt source; other sources need their own explicit guard.';

-- Payment-provider identifiers are the first idempotency boundary. Existing
-- production data was checked for duplicates before these indexes were added.
create unique index if not exists donations_external_reference_unique_idx
  on public.donations (external_reference)
  where nullif(btrim(external_reference), '') is not null;

create unique index if not exists donations_payment_intent_id_unique_idx
  on public.donations (payment_intent_id)
  where nullif(btrim(payment_intent_id), '') is not null;

-- Mark historical successful donations as already reflected in raised_eur.
-- New callbacks are accounted through the atomic RPC below.
alter table public.donations
  add column if not exists raised_counted_at timestamp with time zone;

update public.donations
set raised_counted_at = coalesce(updated_at, created_at, now())
where status = 'succeeded'
  and raised_counted_at is null;

comment on column public.donations.raised_counted_at is
  'Idempotency marker proving that this succeeded donation was included once in donations_meta.raised_eur.';

create or replace function public.record_donation_in_raised_total(
  p_donation_id uuid
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_amount numeric;
  v_meta_id uuid;
begin
  update public.donations as donation
  set raised_counted_at = pg_catalog.now()
  where donation.id = p_donation_id
    and donation.status = 'succeeded'
    and donation.raised_counted_at is null
  returning donation.amount_cents::numeric / 100
  into v_amount;

  if not found then
    return false;
  end if;

  select meta.id
  into v_meta_id
  from public.donations_meta as meta
  order by meta.created_at desc nulls last, meta.id
  limit 1
  for update;

  if v_meta_id is null then
    raise exception 'donations_meta row not found';
  end if;

  update public.donations_meta as meta
  set
    raised_eur = meta.raised_eur + v_amount,
    updated_at = pg_catalog.now()
  where meta.id = v_meta_id;

  return true;
end;
$$;

comment on function public.record_donation_in_raised_total(uuid) is
  'Atomically counts one succeeded donation in raised_eur; repeated callbacks return false without changing totals.';

revoke all on function public.record_donation_in_raised_total(uuid)
  from public, anon, authenticated;
grant execute on function public.record_donation_in_raised_total(uuid)
  to service_role;

create or replace function factpt_private.enqueue_paid_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := pg_catalog.to_jsonb(new);
  v_old jsonb := case
    when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old)
    else '{}'::jsonb
  end;
  v_source_type text;
  v_new_status text;
  v_old_status text;
  v_series_code text;
  v_environment text;
  v_production_pilgrimages_only boolean := false;
  v_production_donations_enabled boolean := false;
  v_go_live_at timestamp with time zone;
  v_donations_go_live_at timestamp with time zone;
  v_pilot_private_only boolean := false;
  v_pilot_marker text;
  v_source_id uuid;
  v_source_reference text;
  v_amount numeric(12, 2);
  v_currency text;
  v_payment_method text;
  v_confirmed_at timestamp with time zone := pg_catalog.clock_timestamp();
  v_comments text;
begin
  case tg_table_name
    when 'donations' then
      v_source_type := 'donation';
      v_new_status := pg_catalog.lower(coalesce(v_new ->> 'status', ''));
      v_old_status := pg_catalog.lower(coalesce(v_old ->> 'status', ''));
      if v_new_status <> 'succeeded' or v_old_status = 'succeeded' then
        return new;
      end if;
      if pg_catalog.lower(coalesce(v_new #>> '{metadata,provider}', '')) <> 'reduniq'
         and pg_catalog.lower(coalesce(v_new ->> 'method', '')) <> 'bank_transfer' then
        return new;
      end if;
      v_series_code := '2026D';
      v_amount := ((v_new ->> 'amount_cents')::numeric / 100)::numeric(12, 2);
      v_currency := pg_catalog.upper(coalesce(v_new ->> 'currency', 'EUR'));
      v_payment_method := v_new ->> 'method';
      v_source_reference := coalesce(
        nullif(v_new ->> 'external_reference', ''),
        nullif(v_new ->> 'payment_intent_id', ''),
        v_new ->> 'id'
      );
      v_comments := 'Doação sem contrapartidas';

    when 'pagamentos_quotas' then
      v_new_status := pg_catalog.lower(coalesce(v_new ->> 'estado', ''));
      v_old_status := pg_catalog.lower(coalesce(v_old ->> 'estado', ''));
      if v_new_status not in ('pago', 'paid')
         or v_old_status in ('pago', 'paid') then
        return new;
      end if;
      if coalesce(v_new ->> 'metodo_pagamento', '') !~*
           '^(reduniq(_.*)?|bank_transfer|transfer)$' then
        return new;
      end if;
      if coalesce(v_new ->> 'notes', '') ~* '\[TYPE:DONATION\]' then
        v_source_type := 'donation';
        v_series_code := '2026D';
        v_comments := 'Doação sem contrapartidas';
      else
        v_source_type := 'quota';
        v_series_code := '2026Q';
        v_comments := null;
      end if;
      v_amount := (v_new ->> 'valor')::numeric(12, 2);
      v_currency := 'EUR';
      v_payment_method := v_new ->> 'metodo_pagamento';
      v_source_reference := coalesce(
        nullif(v_new ->> 'external_reference', ''),
        nullif(v_new ->> 'payment_intent_id', ''),
        v_new ->> 'id'
      );

    when 'store_orders' then
      v_source_type := 'store';
      v_new_status := pg_catalog.lower(coalesce(v_new ->> 'status', ''));
      v_old_status := pg_catalog.lower(coalesce(v_old ->> 'status', ''));
      if v_new_status <> 'paid' or v_old_status = 'paid' then
        return new;
      end if;
      if coalesce(v_new ->> 'payment_provider', '') <> 'reduniq'
         and coalesce(v_new ->> 'payment_method', '') <> 'bank_transfer' then
        return new;
      end if;
      v_series_code := '2026L';
      v_amount := (v_new ->> 'total_amount')::numeric(12, 2);
      v_currency := pg_catalog.upper(coalesce(v_new ->> 'currency', 'EUR'));
      v_payment_method := v_new ->> 'payment_method';
      v_source_reference := coalesce(
        nullif(v_new ->> 'order_ref', ''),
        nullif(v_new ->> 'payment_reference', ''),
        v_new ->> 'id'
      );
      v_comments := null;

    when 'pilgrimage_payments' then
      v_source_type := 'pilgrimage';
      v_new_status := pg_catalog.lower(coalesce(v_new ->> 'status', ''));
      v_old_status := pg_catalog.lower(coalesce(v_old ->> 'status', ''));
      if v_new_status not in ('verified', 'succeeded', 'paid', 'manual')
         or v_old_status in ('verified', 'succeeded', 'paid', 'manual')
         or coalesce((v_new ->> 'deleted')::boolean, false) then
        return new;
      end if;
      if coalesce(v_new ->> 'method', '') ~* '^stripe' then
        return new;
      end if;
      v_series_code := '2026D';
      v_amount := coalesce(
        (v_new ->> 'charged_amount')::numeric(12, 2),
        (v_new ->> 'amount')::numeric(12, 2)
      );
      v_currency := 'EUR';
      v_payment_method := v_new ->> 'method';
      v_source_reference := coalesce(
        nullif(v_new ->> 'external_reference', ''),
        nullif(v_new ->> 'payment_intent_id', ''),
        nullif(v_new ->> 'transaction_id', ''),
        v_new ->> 'id'
      );
      v_comments := 'Doação sem contrapartidas';

    else
      return new;
  end case;

  select
    settings.environment,
    settings.production_pilgrimages_only,
    settings.production_donations_enabled,
    settings.go_live_at,
    settings.donations_go_live_at,
    settings.pilot_private_only,
    settings.pilot_marker
  into
    v_environment,
    v_production_pilgrimages_only,
    v_production_donations_enabled,
    v_go_live_at,
    v_donations_go_live_at,
    v_pilot_private_only,
    v_pilot_marker
  from public.factpt_settings as settings
  where settings.auto_enabled
  order by case when settings.environment = 'production' then 0 else 1 end
  limit 1;

  if v_environment is null then
    return new;
  end if;

  if v_environment = 'sandbox' then
    if v_go_live_at is null or v_confirmed_at < v_go_live_at then
      return new;
    end if;
  elsif tg_table_name = 'pilgrimage_payments' then
    if not v_production_pilgrimages_only
       or v_go_live_at is null
       or v_confirmed_at < v_go_live_at then
      return new;
    end if;
  elsif tg_table_name = 'donations' then
    if not v_production_donations_enabled
       or v_donations_go_live_at is null
       or v_confirmed_at < v_donations_go_live_at then
      return new;
    end if;
  else
    -- Quotas, store orders and legacy donation rows in pagamentos_quotas
    -- remain explicitly outside this production phase.
    return new;
  end if;

  if v_environment = 'production'
     and tg_table_name = 'pilgrimage_payments'
     and v_pilot_private_only then
    if nullif(v_new ->> 'booking_id', '') is null
       or not exists (
         select 1
         from public.bookings as booking
         join public.pilgrimages as pilgrimage
           on pilgrimage.id = booking.pilgrimage_id
         where booking.id = (v_new ->> 'booking_id')::uuid
           and booking.user_id::text = coalesce(
             pilgrimage.pricing_config ->> 'private_test_user_id',
             ''
           )
           and pg_catalog.strpos(
             coalesce(booking.notes, ''),
             v_pilot_marker
           ) > 0
           and coalesce(pilgrimage.title, '')
             like '[TESTE PRIVADO FACT.pt]%'
       ) then
      return new;
    end if;
  end if;

  v_source_id := (v_new ->> 'id')::uuid;

  insert into public.factpt_documents (
    environment,
    source_type,
    source_table,
    source_id,
    source_reference,
    series_code,
    credential_alias,
    identifier_id,
    amount,
    currency,
    payment_method,
    payment_confirmed_at,
    comments,
    source_snapshot
  )
  values (
    v_environment,
    v_source_type,
    tg_table_name,
    v_source_id,
    v_source_reference,
    v_series_code,
    v_series_code,
    case
      when pg_catalog.char_length(
        'gp:' || v_source_type || ':' || v_source_id::text
      ) <= 50
        then 'gp:' || v_source_type || ':' || v_source_id::text
      else
        'gp:' || v_source_type || ':'
          || pg_catalog.replace(v_source_id::text, '-', '')
    end,
    v_amount,
    v_currency,
    v_payment_method,
    v_confirmed_at,
    v_comments,
    v_new
  )
  on conflict (environment, source_type, source_id) do nothing;

  return new;
end;
$$;

revoke all on function factpt_private.enqueue_paid_payment()
  from public, anon, authenticated;
