-- COALESCE is SQL syntax, not a pg_catalog function. The original FACT.pt
-- queue trigger qualified it as pg_catalog.coalesce(), causing every source
-- insert/update handled by the trigger to fail before the sandbox guard ran.
do $migration$
declare
  v_function_sql text;
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

  v_function_sql := pg_catalog.replace(
    v_function_sql,
    'pg_catalog.coalesce(',
    'coalesce('
  );

  execute v_function_sql;
end
$migration$;
