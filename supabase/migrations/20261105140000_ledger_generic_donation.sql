-- A bank donation from someone we know nothing about, up to the 100 € FACT.pt
-- accepts for its generic "Consumidor final". The admin confirms each one.

create or replace function public.ledger_register_generic_donation_transfer(
  p_transaction_id uuid,
  p_admin_user_id uuid,
  p_actor text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_movement public.bank_transactions%rowtype;
  v_from date;
  v_donation_id uuid;
begin
  select * into v_movement from public.bank_transactions
  where id = p_transaction_id for update;
  if not found or v_movement.amount <= 0 or v_movement.status not in ('unreviewed', 'suggested') then
    raise exception 'Movimento indisponível para registar como doação.' using errcode = 'P0001';
  end if;
  if v_movement.amount > 100 then
    raise exception 'Acima de 100 € a lei exige nome e morada.' using errcode = 'P0001';
  end if;
  perform public.ledger_assert_period_open(v_movement.period);
  if exists (select 1 from public.bank_transaction_links where bank_transaction_id = p_transaction_id) then
    raise exception 'Este movimento já está associado. Reveja as ligações existentes.' using errcode = 'P0001';
  end if;

  select app_donation_fr_from into v_from from public.bank_accounts where id = v_movement.account_id;
  if v_from is null or v_movement.booking_date < v_from then
    raise exception 'A emissão pela app não está ativa para movimentos desta data. A FR destes movimentos é emitida na FACT.pt.' using errcode = 'P0001';
  end if;

  insert into public.donations (
    amount_cents, currency, method, status, description, external_reference,
    donor_name, receipt_required, receipt_status, reviewed_at, reviewed_by, metadata
  ) values (
    round(v_movement.amount * 100)::integer, 'EUR', 'bank_transfer', 'succeeded',
    'Doação por transferência bancária', 'BANK-' || left(p_transaction_id::text, 8),
    'Consumidor final', false, 'not_required', now(), p_admin_user_id,
    jsonb_build_object(
      'confirmed_via', 'contabilidade',
      'bank_transaction_id', p_transaction_id::text,
      'factpt_generic_consumer', true,
      'bank_payer', v_movement.counterparty_name
    )
  ) returning id into v_donation_id;

  -- The paid-payment trigger queues the FR. Without it nothing is registered.
  if not exists (
    select 1 from public.factpt_documents d
    where d.environment = 'production' and d.source_table = 'donations' and d.source_id = v_donation_id
  ) then
    raise exception 'O pedido de FR não foi criado pela FACT.pt. Nenhuma doação foi registada.' using errcode = 'P0001';
  end if;

  insert into public.bank_transaction_links (
    bank_transaction_id, target_type, target_id, amount, label, method, created_by
  ) values (
    p_transaction_id, 'donation', v_donation_id::text, v_movement.amount,
    'Doação · ' || coalesce(v_movement.counterparty_name, 'Consumidor final'), 'manual', p_actor
  );

  update public.bank_transactions
  set category_code = 'doacao', status = 'suggested', reviewed_by = p_actor, reviewed_at = now()
  where id = p_transaction_id;

  return v_donation_id;
end;
$$;

revoke all on function public.ledger_register_generic_donation_transfer(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ledger_register_generic_donation_transfer(uuid, uuid, text) to service_role;
