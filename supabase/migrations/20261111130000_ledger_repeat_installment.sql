-- Allow another instalment of the same amount only when earlier instalments
-- of that amount are already reconciled to their own bank movements. Patch the
-- existing function body so other production fixes are preserved.
do $migration$
declare
  definition text;
  old_guard text := $old$and p.method = 'bank_transfer' and not coalesce(p.deleted, false)
    ) then$old$;
  new_guard text := $new$and p.method = 'bank_transfer' and not coalesce(p.deleted, false)
        and not exists (
          select 1 from public.bank_transaction_links l
          where l.target_type = 'pilgrimage_payment' and l.target_id = p.id::text
        )
    ) then$new$;
begin
  select pg_get_functiondef('public.ledger_register_pilgrimage_transfer(uuid,uuid,uuid,uuid,text)'::regprocedure)
    into definition;
  if strpos(definition, new_guard) = 0 then
    if strpos(definition, old_guard) = 0 then
      raise exception 'Unrecognized ledger_register_pilgrimage_transfer guard; migration stopped.';
    end if;
    execute replace(definition, old_guard, new_guard);
  end if;
end
$migration$;

revoke all on function public.ledger_register_pilgrimage_transfer(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ledger_register_pilgrimage_transfer(uuid, uuid, uuid, uuid, text) to service_role;
