-- Keep the pilgrimage principal separate from the total collected through
-- Reduniq. `amount` continues to be the value credited to the booking, while
-- FACT.pt uses the gross `charged_amount`.
alter table public.pilgrimage_payments
  add column if not exists processing_fee_amount numeric(12, 2)
    not null default 0
    check (processing_fee_amount >= 0),
  add column if not exists charged_amount numeric(12, 2)
    generated always as (
      round(amount + processing_fee_amount, 2)
    ) stored;

comment on column public.pilgrimage_payments.amount is
  'Principal credited to the pilgrimage booking balance; excludes Reduniq processing fee.';
comment on column public.pilgrimage_payments.processing_fee_amount is
  'Reduniq processing amount charged to the payer in addition to the booking principal.';
comment on column public.pilgrimage_payments.charged_amount is
  'Gross amount charged to the payer and used as the FACT.pt document total.';

-- Automatic FACT.pt queueing is disabled in sandbox, but this keeps the
-- production-safe trigger correct before it is ever enabled.
do $migration$
declare
  v_function_sql text;
  v_old_assignment text :=
    'v_amount := (v_new ->> ''amount'')::numeric(12, 2);';
  v_new_assignment text :=
    'v_amount := coalesce((v_new ->> ''charged_amount'')::numeric(12, 2), (v_new ->> ''amount'')::numeric(12, 2));';
begin
  select pg_catalog.pg_get_functiondef(proc.oid)
    into v_function_sql
  from pg_catalog.pg_proc as proc
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = proc.pronamespace
  where namespace.nspname = 'factpt_private'
    and proc.proname = 'enqueue_paid_payment'
    and pg_catalog.pg_get_function_identity_arguments(proc.oid) = '';

  if v_function_sql is null then
    raise exception 'factpt_private.enqueue_paid_payment() was not found';
  end if;

  if pg_catalog.strpos(v_function_sql, v_old_assignment) = 0 then
    raise exception
      'Expected pilgrimage amount assignment was not found in FACT.pt trigger';
  end if;

  v_function_sql := pg_catalog.replace(
    v_function_sql,
    v_old_assignment,
    v_new_assignment
  );

  execute v_function_sql;
end
$migration$;
