-- Prepare a tightly scoped FACT.pt production pilot. The production row is
-- deliberately seeded disabled; deployment secrets and a separate activation
-- are required before any payment can enter the production queue.
alter table public.factpt_settings
  add column if not exists pilot_private_only boolean not null default false,
  add column if not exists pilot_marker text;

alter table public.factpt_settings
  drop constraint if exists factpt_settings_production_disabled;

alter table public.factpt_settings
  add constraint factpt_settings_production_pilot_guard
  check (
    environment <> 'production'
    or not auto_enabled
    or (
      require_approval
      and pilot_private_only
      and nullif(btrim(pilot_marker), '') is not null
    )
  );

comment on column public.factpt_settings.pilot_private_only is
  'When enabled for production, queueing is restricted to the explicitly marked private FACT.pt pilgrimage fixture.';
comment on column public.factpt_settings.pilot_marker is
  'Exact server-side booking note marker required by the production pilot trigger.';

insert into public.factpt_settings (
  environment,
  auto_enabled,
  go_live_at,
  test_email,
  require_approval,
  pilot_private_only,
  pilot_marker
)
values (
  'production',
  false,
  null,
  null,
  true,
  true,
  '[FACTPT:PRODUCTION_PILOT]'
)
on conflict (environment) do update
set
  auto_enabled = false,
  go_live_at = null,
  test_email = null,
  require_approval = true,
  pilot_private_only = true,
  pilot_marker = excluded.pilot_marker;

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
      v_new_status := pg_catalog.lower(pg_catalog.coalesce(v_new ->> 'status', ''));
      v_old_status := pg_catalog.lower(pg_catalog.coalesce(v_old ->> 'status', ''));
      if v_new_status <> 'succeeded' or v_old_status = 'succeeded' then
        return new;
      end if;
      if pg_catalog.coalesce(v_new #>> '{metadata,provider}', '') <> 'reduniq'
         and pg_catalog.coalesce(v_new ->> 'method', '') <> 'bank_transfer' then
        return new;
      end if;
      v_series_code := '2026D';
      v_amount := ((v_new ->> 'amount_cents')::numeric / 100)::numeric(12, 2);
      v_currency := pg_catalog.upper(pg_catalog.coalesce(v_new ->> 'currency', 'EUR'));
      v_payment_method := v_new ->> 'method';
      v_source_reference := pg_catalog.coalesce(
        v_new ->> 'external_reference',
        v_new ->> 'payment_intent_id',
        v_new ->> 'id'
      );
      v_comments := 'Doação sem contrapartidas';

    when 'pagamentos_quotas' then
      v_new_status := pg_catalog.lower(pg_catalog.coalesce(v_new ->> 'estado', ''));
      v_old_status := pg_catalog.lower(pg_catalog.coalesce(v_old ->> 'estado', ''));
      if v_new_status not in ('pago', 'paid')
         or v_old_status in ('pago', 'paid') then
        return new;
      end if;
      if pg_catalog.coalesce(v_new ->> 'metodo_pagamento', '') !~*
           '^(reduniq(_.*)?|bank_transfer|transfer)$' then
        return new;
      end if;
      if pg_catalog.coalesce(v_new ->> 'notes', '') ~* '\[TYPE:DONATION\]' then
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
      v_source_reference := pg_catalog.coalesce(
        v_new ->> 'external_reference',
        v_new ->> 'payment_intent_id',
        v_new ->> 'id'
      );

    when 'store_orders' then
      v_source_type := 'store';
      v_new_status := pg_catalog.lower(pg_catalog.coalesce(v_new ->> 'status', ''));
      v_old_status := pg_catalog.lower(pg_catalog.coalesce(v_old ->> 'status', ''));
      if v_new_status <> 'paid' or v_old_status = 'paid' then
        return new;
      end if;
      if pg_catalog.coalesce(v_new ->> 'payment_provider', '') <> 'reduniq'
         and pg_catalog.coalesce(v_new ->> 'payment_method', '') <> 'bank_transfer' then
        return new;
      end if;
      v_series_code := '2026L';
      v_amount := (v_new ->> 'total_amount')::numeric(12, 2);
      v_currency := pg_catalog.upper(pg_catalog.coalesce(v_new ->> 'currency', 'EUR'));
      v_payment_method := v_new ->> 'payment_method';
      v_source_reference := pg_catalog.coalesce(
        v_new ->> 'order_ref',
        v_new ->> 'payment_reference',
        v_new ->> 'id'
      );
      v_comments := null;

    when 'pilgrimage_payments' then
      v_source_type := 'pilgrimage';
      v_new_status := pg_catalog.lower(pg_catalog.coalesce(v_new ->> 'status', ''));
      v_old_status := pg_catalog.lower(pg_catalog.coalesce(v_old ->> 'status', ''));
      if v_new_status not in ('verified', 'succeeded', 'paid', 'manual')
         or v_old_status in ('verified', 'succeeded', 'paid', 'manual')
         or pg_catalog.coalesce((v_new ->> 'deleted')::boolean, false) then
        return new;
      end if;
      if pg_catalog.coalesce(v_new ->> 'method', '') ~* '^stripe' then
        return new;
      end if;
      v_series_code := '2026D';
      v_amount := pg_catalog.coalesce(
        (v_new ->> 'charged_amount')::numeric(12, 2),
        (v_new ->> 'amount')::numeric(12, 2)
      );
      v_currency := 'EUR';
      v_payment_method := v_new ->> 'method';
      v_source_reference := pg_catalog.coalesce(
        v_new ->> 'external_reference',
        v_new ->> 'payment_intent_id',
        v_new ->> 'transaction_id',
        v_new ->> 'id'
      );
      v_comments := 'Doação sem contrapartidas';

    else
      return new;
  end case;

  select
    settings.environment,
    settings.pilot_private_only,
    settings.pilot_marker
  into
    v_environment,
    v_pilot_private_only,
    v_pilot_marker
  from public.factpt_settings as settings
  where settings.auto_enabled
    and settings.go_live_at is not null
    and v_confirmed_at >= settings.go_live_at
  limit 1;

  if v_environment is null then
    return new;
  end if;

  -- The production pilot cannot capture any source except the marked private
  -- pilgrimage fixture whose account holder matches pricing_config.
  if v_environment = 'production' and v_pilot_private_only then
    if tg_table_name <> 'pilgrimage_payments'
       or nullif(v_new ->> 'booking_id', '') is null
       or not exists (
         select 1
         from public.bookings as booking
         join public.pilgrimages as pilgrimage
           on pilgrimage.id = booking.pilgrimage_id
         where booking.id = (v_new ->> 'booking_id')::uuid
           and booking.user_id::text = pg_catalog.coalesce(
             pilgrimage.pricing_config ->> 'private_test_user_id',
             ''
           )
           and pg_catalog.strpos(
             pg_catalog.coalesce(booking.notes, ''),
             v_pilot_marker
           ) > 0
           and pg_catalog.coalesce(pilgrimage.title, '')
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
