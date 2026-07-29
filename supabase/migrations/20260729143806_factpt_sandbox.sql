-- FACT.pt sandbox persistence, queueing and payment capture.
-- This migration is intentionally safe by default: the seeded sandbox
-- configuration has automatic queueing disabled and no go-live timestamp.

create schema if not exists factpt_private;

revoke all on schema factpt_private from public;
revoke all on schema factpt_private from anon;
revoke all on schema factpt_private from authenticated;

-- Preserve the legacy FACT.pt log table used by the previous integration.
-- Its seven historical rows have a different shape and must not be coerced
-- into the durable queue introduced below.
do $$
declare
  legacy_index record;
begin
  if to_regclass('public.factpt_documents') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'factpt_documents'
         and column_name = 'environment'
     ) then
    if to_regclass('public.factpt_documents_legacy') is not null then
      raise exception
        'Both factpt_documents and factpt_documents_legacy exist; manual review required';
    end if;

    alter table public.factpt_documents rename to factpt_documents_legacy;

    if exists (
      select 1
      from pg_constraint
      where conrelid = 'public.factpt_documents_legacy'::regclass
        and conname = 'factpt_documents_pkey'
    ) then
      alter table public.factpt_documents_legacy
        rename constraint factpt_documents_pkey
        to factpt_documents_legacy_pkey;
    end if;

    for legacy_index in
      select index_class.relname as index_name
      from pg_index
      join pg_class as index_class on index_class.oid = pg_index.indexrelid
      where pg_index.indrelid = 'public.factpt_documents_legacy'::regclass
        and index_class.relname like 'factpt_documents%'
        and index_class.relname not like 'factpt_documents_legacy%'
    loop
      execute format(
        'alter index public.%I rename to %I',
        legacy_index.index_name,
        replace(
          legacy_index.index_name,
          'factpt_documents',
          'factpt_documents_legacy'
        )
      );
    end loop;
  end if;
end;
$$;

-- Preserve the client cache used by the previous FACT.pt integration. Its
-- user/email-oriented shape is incompatible with the environment/series/TIN
-- cache required by the new worker.
do $$
declare
  legacy_index record;
begin
  if to_regclass('public.factpt_clients') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'factpt_clients'
         and column_name = 'environment'
     ) then
    if to_regclass('public.factpt_clients_legacy') is not null then
      raise exception
        'Both factpt_clients and factpt_clients_legacy exist; manual review required';
    end if;

    alter table public.factpt_clients rename to factpt_clients_legacy;

    if exists (
      select 1
      from pg_constraint
      where conrelid = 'public.factpt_clients_legacy'::regclass
        and conname = 'factpt_clients_pkey'
    ) then
      alter table public.factpt_clients_legacy
        rename constraint factpt_clients_pkey
        to factpt_clients_legacy_pkey;
    end if;

    for legacy_index in
      select index_class.relname as index_name
      from pg_index
      join pg_class as index_class on index_class.oid = pg_index.indexrelid
      where pg_index.indrelid = 'public.factpt_clients_legacy'::regclass
        and index_class.relname like 'factpt_clients%'
        and index_class.relname not like 'factpt_clients_legacy%'
    loop
      execute format(
        'alter index public.%I rename to %I',
        legacy_index.index_name,
        replace(
          legacy_index.index_name,
          'factpt_clients',
          'factpt_clients_legacy'
        )
      );
    end loop;
  end if;
end;
$$;

create table public.factpt_settings (
  environment text primary key
    check (environment in ('sandbox', 'production')),
  auto_enabled boolean not null default false,
  go_live_at timestamp with time zone,
  test_email text,
  last_diagnostic_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint factpt_settings_enabled_requires_go_live
    check (not auto_enabled or go_live_at is not null),
  constraint factpt_settings_production_disabled
    check (environment <> 'production' or not auto_enabled),
  constraint factpt_settings_sandbox_enabled_requires_test_email
    check (
      environment <> 'sandbox'
      or not auto_enabled
      or nullif(btrim(test_email), '') is not null
    )
);

comment on table public.factpt_settings is
  'Non-secret FACT.pt environment controls. API keys remain server-side environment variables.';
comment on column public.factpt_settings.auto_enabled is
  'Payment triggers enqueue documents only when exactly one environment is enabled.';
comment on column public.factpt_settings.go_live_at is
  'Only paid transitions confirmed at or after this timestamp are enqueued.';

create unique index factpt_settings_one_enabled_environment_idx
  on public.factpt_settings ((auto_enabled))
  where auto_enabled;

insert into public.factpt_settings (
  environment,
  auto_enabled,
  go_live_at,
  test_email
)
values ('sandbox', false, null, null)
on conflict (environment) do nothing;

create table public.factpt_clients (
  id uuid primary key default gen_random_uuid(),
  environment text not null
    check (environment in ('sandbox', 'production')),
  credential_alias text not null
    check (credential_alias in ('2026Q', '2026L', '2026D')),
  tin text not null
    check (tin = btrim(tin) and tin <> ''),
  factpt_client_id text not null
    check (btrim(factpt_client_id) <> ''),
  name text,
  email text,
  last_confirmed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint factpt_clients_environment_credential_tin_key
    unique (environment, credential_alias, tin)
);

comment on table public.factpt_clients is
  'Server-only cache of FACT.pt clients found or created by normalized tax number.';

create index factpt_clients_tin_idx
  on public.factpt_clients (environment, tin);

create table public.factpt_documents (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'sandbox'
    check (environment in ('sandbox', 'production')),
  source_type text not null
    check (source_type in ('quota', 'store', 'donation', 'pilgrimage')),
  source_table text not null
    check (
      source_table in (
        'pagamentos_quotas',
        'store_orders',
        'donations',
        'pilgrimage_payments'
      )
    ),
  source_id uuid not null,
  source_reference text,
  series_code text not null
    check (series_code in ('2026Q', '2026L', '2026D')),
  credential_alias text not null
    check (credential_alias in ('2026Q', '2026L', '2026D')),
  document_type text
    check (
      document_type is null
      or document_type in ('invoice_receipt', 'simplified_invoice')
    ),
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'needs_data',
        'processing',
        'issued',
        'failed',
        'email_failed'
      )
    ),
  identifier_id text not null,
  amount numeric(12, 2)
    check (amount is null or amount > 0),
  currency text not null default 'EUR'
    check (currency ~ '^[A-Z]{3}$'),
  payment_method text,
  payment_confirmed_at timestamp with time zone not null,
  email_to text,
  comments text,
  source_snapshot jsonb not null default '{}'::jsonb,
  fiscal_snapshot jsonb not null default '{}'::jsonb,
  document_payload jsonb,
  factpt_response jsonb,
  client_cache_id uuid references public.factpt_clients(id) on delete set null,
  client_action text
    check (
      client_action is null
      or client_action in ('reused', 'created', 'final_consumer')
    ),
  factpt_document_id text,
  factpt_number text,
  permanent_url text,
  pdf_url text,
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  email_attempt_count integer not null default 0
    check (email_attempt_count >= 0),
  next_attempt_at timestamp with time zone not null default now(),
  processing_started_at timestamp with time zone,
  last_error_code text,
  last_error text,
  email_last_error text,
  issued_at timestamp with time zone,
  email_sent_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint factpt_documents_source_key
    unique (environment, source_type, source_id),
  constraint factpt_documents_source_table_key
    unique (environment, source_table, source_id),
  constraint factpt_documents_identifier_id_key
    unique (environment, identifier_id),
  constraint factpt_documents_identifier_format_check
    check (
      char_length(identifier_id) between 1 and 50
      and identifier_id ~ '^[A-Za-z0-9:{}-]+$'
    ),
  constraint factpt_documents_series_source_check
    check (
      (source_type = 'quota' and series_code = '2026Q' and credential_alias = '2026Q')
      or (source_type = 'store' and series_code = '2026L' and credential_alias = '2026L')
      or (
        source_type in ('donation', 'pilgrimage')
        and series_code = '2026D'
        and credential_alias = '2026D'
      )
    ),
  constraint factpt_documents_source_table_type_check
    check (
      (source_table = 'pagamentos_quotas' and source_type in ('quota', 'donation'))
      or (source_table = 'store_orders' and source_type = 'store')
      or (source_table = 'donations' and source_type = 'donation')
      or (
        source_table = 'pilgrimage_payments'
        and source_type = 'pilgrimage'
      )
    ),
  constraint factpt_documents_donation_comments_check
    check (
      source_type not in ('donation', 'pilgrimage')
      or comments = 'Doação sem contrapartidas'
    )
);

comment on table public.factpt_documents is
  'Durable FACT.pt queue and fiscal document record; exactly one row per source payment.';
comment on column public.factpt_documents.source_snapshot is
  'Payment row as observed at the paid transition. Accessible to server-side code only.';
comment on column public.factpt_documents.source_table is
  'Physical source table; needed when a pagamentos_quotas row is classified as a donation.';
comment on column public.factpt_documents.fiscal_snapshot is
  'Immutable normalized billing and line-item snapshot populated before issuance.';
comment on column public.factpt_documents.identifier_id is
  'Deterministic FACT.pt idempotency key, limited to the documented 50 characters.';
comment on column public.factpt_documents.client_action is
  'Whether the issue reused/created a FACT.pt client or used Consumidor Final.';

create index factpt_documents_claim_idx
  on public.factpt_documents (
    environment,
    next_attempt_at,
    payment_confirmed_at,
    created_at
  )
  where status = 'pending';

create index factpt_documents_stale_processing_idx
  on public.factpt_documents (environment, processing_started_at)
  where status = 'processing';

create index factpt_documents_admin_filter_idx
  on public.factpt_documents (status, series_code, source_type, created_at desc);

create index factpt_documents_client_cache_id_idx
  on public.factpt_documents (client_cache_id)
  where client_cache_id is not null;

-- The live checkout persists the selected Reduniq solution before the gateway
-- callback. Keep historical Stripe values valid, but expose no Stripe path in
-- the FACT.pt queue.
alter table public.pilgrimage_payments
  drop constraint if exists pilgrimage_payments_method_check;

alter table public.pilgrimage_payments
  add constraint pilgrimage_payments_method_check
  check (
    method in (
      'wise',
      'bank_transfer',
      'transfer',
      'mbway',
      'manual',
      'stripe',
      'stripe_checkout',
      'reduniq',
      'reduniq_card',
      'reduniq_mbway',
      'reduniq_pix',
      'reduniq_multibanco'
    )
  );

alter table public.pilgrimage_payments
  drop constraint if exists pilgrimage_payments_status_check;

alter table public.pilgrimage_payments
  add constraint pilgrimage_payments_status_check
  check (
    status in (
      'pending',
      'pending_verification',
      'verifying',
      'succeeded',
      'verified',
      'paid',
      'manual',
      'failed'
    )
  );

-- New orders persist the fiscal line data used by the FACT.pt builder.
-- Existing rows remain null: this migration deliberately performs no backfill.
alter table public.store_order_items
  add column if not exists tax_rate numeric(5, 2),
  add column if not exists sku text,
  add column if not exists item_type text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.store_order_items'::regclass
      and conname = 'store_order_items_tax_rate_check'
  ) then
    alter table public.store_order_items
      add constraint store_order_items_tax_rate_check
      check (tax_rate is null or tax_rate between 0 and 100);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.store_order_items'::regclass
      and conname = 'store_order_items_item_type_check'
  ) then
    alter table public.store_order_items
      add constraint store_order_items_item_type_check
      check (item_type is null or item_type in ('product', 'service'));
  end if;
end
$$;

comment on column public.store_order_items.tax_rate is
  'VAT percentage snapshot for the paid order line (for example 6.00 or 23.00).';
comment on column public.store_order_items.sku is
  'Stable store/FACT.pt product reference captured when the order is created.';
comment on column public.store_order_items.item_type is
  'FACT.pt line classification captured when the order is created.';

create or replace function factpt_private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger factpt_settings_set_updated_at
before update on public.factpt_settings
for each row execute function factpt_private.set_updated_at();

create trigger factpt_clients_set_updated_at
before update on public.factpt_clients
for each row execute function factpt_private.set_updated_at();

create trigger factpt_documents_set_updated_at
before update on public.factpt_documents
for each row execute function factpt_private.set_updated_at();

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
      v_amount := (v_new ->> 'amount')::numeric(12, 2);
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

  -- The trigger execution time is the only consistent paid-confirmation
  -- timestamp across all four source tables.
  select settings.environment
    into v_environment
  from public.factpt_settings as settings
  where settings.auto_enabled
    and settings.go_live_at is not null
    and v_confirmed_at >= settings.go_live_at
  limit 1;

  if v_environment is null then
    return new;
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

create trigger factpt_enqueue_donation
after insert or update of status on public.donations
for each row execute function factpt_private.enqueue_paid_payment();

create trigger factpt_enqueue_quota
after insert or update of estado on public.pagamentos_quotas
for each row execute function factpt_private.enqueue_paid_payment();

create trigger factpt_enqueue_store_order
after insert or update of status on public.store_orders
for each row execute function factpt_private.enqueue_paid_payment();

create trigger factpt_enqueue_pilgrimage_payment
after insert or update of status on public.pilgrimage_payments
for each row execute function factpt_private.enqueue_paid_payment();

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

  return query
  with candidates as (
    select documents.id
    from public.factpt_documents as documents
    where documents.environment = p_environment
      and (
        (
          documents.status = 'pending'
          and documents.next_attempt_at <= pg_catalog.now()
        )
        or (
          documents.status = 'processing'
          and documents.processing_started_at
            <= pg_catalog.now() - pg_catalog.make_interval(
              secs => p_stale_after_seconds
            )
        )
      )
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
  'Atomically claims due FACT.pt jobs and recovers processing rows stale beyond the supplied timeout.';

alter table public.factpt_settings enable row level security;
alter table public.factpt_clients enable row level security;
alter table public.factpt_documents enable row level security;

revoke all on table public.factpt_settings from public, anon, authenticated;
revoke all on table public.factpt_clients from public, anon, authenticated;
revoke all on table public.factpt_documents from public, anon, authenticated;

grant select, update
  on table public.factpt_settings
  to service_role;
grant select, insert, update
  on table public.factpt_clients
  to service_role;
grant select, insert, update
  on table public.factpt_documents
  to service_role;

revoke all on function factpt_private.set_updated_at() from public, anon, authenticated;
revoke all on function factpt_private.enqueue_paid_payment() from public, anon, authenticated;
revoke all on function public.claim_factpt_documents(integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_factpt_documents(integer, integer, text)
  to service_role;
