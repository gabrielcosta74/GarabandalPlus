-- COALESCE is SQL syntax and cannot be schema-qualified. The production pilot
-- migration recreated the FACT.pt trigger after the original repair and
-- accidentally restored pg_catalog.coalesce(...), blocking even pending
-- pilgrimage payment inserts before any Reduniq redirect could occur.
do $migration$
declare
  v_function_sql text;
  v_repaired_sql text;
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

  if pg_catalog.strpos(v_function_sql, 'pg_catalog.coalesce(') = 0 then
    raise exception
      'Expected invalid pg_catalog.coalesce() calls were not found';
  end if;

  v_repaired_sql := pg_catalog.replace(
    v_function_sql,
    'pg_catalog.coalesce(',
    'coalesce('
  );

  execute v_repaired_sql;

  select pg_catalog.pg_get_functiondef(proc.oid)
    into v_function_sql
  from pg_catalog.pg_proc as proc
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = proc.pronamespace
  where namespace.nspname = 'factpt_private'
    and proc.proname = 'enqueue_paid_payment'
    and pg_catalog.pg_get_function_identity_arguments(proc.oid) = '';

  if pg_catalog.strpos(v_function_sql, 'pg_catalog.coalesce(') > 0 then
    raise exception
      'FACT.pt trigger still contains invalid pg_catalog.coalesce() calls';
  end if;
end
$migration$;

revoke all on function factpt_private.enqueue_paid_payment()
  from public, anon, authenticated;
