-- Promote the validated FACT.pt 2026D pilgrimage pilot to a production mode
-- that can run without per-document approval. The migration deliberately
-- keeps the current setting values unchanged; activation happens only after
-- the matching application/worker deployment is verified.

alter table public.factpt_settings
  add column if not exists production_pilgrimages_only boolean not null default false;

update public.factpt_settings
set production_pilgrimages_only = true
where environment = 'production';

alter table public.factpt_settings
  drop constraint if exists factpt_settings_production_pilot_guard;

alter table public.factpt_settings
  add constraint factpt_settings_production_scope_guard
  check (
    environment <> 'production'
    or not auto_enabled
    or production_pilgrimages_only
  );

comment on column public.factpt_settings.production_pilgrimages_only is
  'Hard production scope guard: only pilgrimage_payments may enter the automatic FACT.pt queue.';

create index if not exists factpt_documents_automatic_email_retry_idx
  on public.factpt_documents (environment, next_attempt_at, created_at)
  where status = 'email_failed' and email_attempt_count < 5;

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
    settings.production_pilgrimages_only,
    settings.pilot_private_only,
    settings.pilot_marker
  into
    v_environment,
    v_production_pilgrimages_only,
    v_pilot_private_only,
    v_pilot_marker
  from public.factpt_settings as settings
  where settings.auto_enabled
    and settings.go_live_at is not null
    and v_confirmed_at >= settings.go_live_at
  order by case when settings.environment = 'production' then 0 else 1 end
  limit 1;

  if v_environment is null then
    return new;
  end if;

  -- Production is intentionally restricted to pilgrimage payments, even if a
  -- future settings change accidentally enables another source.
  if v_environment = 'production' then
    if not v_production_pilgrimages_only
       or tg_table_name <> 'pilgrimage_payments' then
      return new;
    end if;

    -- Retain the private-pilot gate while the deployment is in review mode.
    if v_pilot_private_only then
      if nullif(v_new ->> 'booking_id', '') is null
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

  -- A stale worker that was only resending an already-issued PDF is safe to
  -- retry as email-only work. It must never fall into the emission path.
  update public.factpt_documents as documents
  set
    status = 'email_failed',
    last_error_code = 'stale_email_processing_retry',
    last_error = 'O worker terminou durante o reenvio do PDF; será repetido apenas o email.',
    next_attempt_at = pg_catalog.now(),
    processing_started_at = null
  where documents.environment = p_environment
    and documents.status = 'processing'
    and documents.factpt_document_id is not null
    and documents.factpt_number is not null
    and documents.issued_at is not null
    and (
      documents.processing_started_at is null
      or documents.processing_started_at
        <= pg_catalog.now() - pg_catalog.make_interval(
          secs => p_stale_after_seconds
        )
    );

  -- A stale emission is ambiguous because the remote API may have accepted
  -- the identifierId before the local worker stopped.
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
    and documents.factpt_document_id is null
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
      and documents.next_attempt_at <= pg_catalog.now()
      and (
        documents.status = 'pending'
        or (
          documents.status = 'email_failed'
          and documents.email_attempt_count < 5
          and documents.factpt_document_id is not null
          and documents.factpt_number is not null
          and documents.issued_at is not null
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
  'Claims emissions and bounded email-only retries; ambiguous stale emissions are quarantined.';

revoke all on function public.claim_factpt_documents(integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_factpt_documents(integer, integer, text)
  to service_role;
