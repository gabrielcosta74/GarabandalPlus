-- Acordos com fornecedor: corrigir e cancelar.
--
-- Até aqui um acordo (proforma) só se criava. Um total errado bloqueava os
-- pagamentos seguintes ("ultrapassa o total") e não havia forma de o corrigir.
-- As duas funções trancam a linha do acordo, tal como a ligação de pagamentos,
-- para que uma correção e uma ligação ao mesmo tempo não deixem o total abaixo
-- do que já foi pago.

create or replace function public.ledger_update_agreement(
  p_agreement_id uuid,
  p_supplier text,
  p_description text,
  p_total numeric,
  p_paid_outside_bank numeric,
  p_hotel_stay_id uuid,
  p_cost_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_agreement public.supplier_agreements%rowtype;
  v_bank numeric;
  v_line_pilgrimage uuid;
begin
  select * into v_agreement from public.supplier_agreements where id = p_agreement_id for update;
  if not found then
    raise exception 'Acordo não encontrado.' using errcode = 'P0001';
  end if;
  if v_agreement.status <> 'open' then
    raise exception 'Este acordo está cancelado.' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_supplier), '') = '' then
    raise exception 'Escreva o fornecedor.' using errcode = 'P0001';
  end if;
  if p_total is null or p_total <= 0 then
    raise exception 'Indique o valor total da proforma.' using errcode = 'P0001';
  end if;
  if p_paid_outside_bank is null or p_paid_outside_bank < 0 then
    raise exception 'O valor já pago fora do banco não é válido.' using errcode = 'P0001';
  end if;
  if p_hotel_stay_id is not null and p_cost_id is not null then
    raise exception 'Escolha só uma linha da logística.' using errcode = 'P0001';
  end if;

  select coalesce(sum(l.amount), 0) into v_bank
  from public.bank_transaction_links l
  where l.target_type = 'agreement' and l.target_id = p_agreement_id::text;

  if v_bank + p_paid_outside_bank > p_total + 0.01 then
    raise exception 'O total não pode ficar abaixo do que já foi pago (% €).', v_bank + p_paid_outside_bank
      using errcode = 'P0001';
  end if;

  if p_hotel_stay_id is not null or p_cost_id is not null then
    if p_hotel_stay_id is not null then
      select pilgrimage_id into v_line_pilgrimage from public.pilgrimage_hotel_stays where id = p_hotel_stay_id;
    else
      select pilgrimage_id into v_line_pilgrimage from public.pilgrimage_costs where id = p_cost_id;
    end if;
    if v_line_pilgrimage is distinct from v_agreement.pilgrimage_id then
      raise exception 'Essa linha da logística é de outra peregrinação.' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.supplier_agreements a
      where a.id <> p_agreement_id
        and ((p_hotel_stay_id is not null and a.hotel_stay_id = p_hotel_stay_id)
          or (p_cost_id is not null and a.cost_id = p_cost_id))
    ) then
      raise exception 'Essa linha da logística já tem um acordo.' using errcode = 'P0001';
    end if;
  end if;

  -- A linha que deixa de estar ligada volta a não ter nada pago pelo banco.
  if v_agreement.hotel_stay_id is not null and v_agreement.hotel_stay_id is distinct from p_hotel_stay_id then
    update public.pilgrimage_hotel_stays set paid_amount = 0 where id = v_agreement.hotel_stay_id;
  end if;
  if v_agreement.cost_id is not null and v_agreement.cost_id is distinct from p_cost_id then
    update public.pilgrimage_costs set paid_amount = 0 where id = v_agreement.cost_id;
  end if;

  update public.supplier_agreements set
    supplier = left(btrim(p_supplier), 120),
    description = nullif(left(btrim(coalesce(p_description, '')), 300), ''),
    total_amount = round(p_total, 2),
    paid_outside_bank = round(p_paid_outside_bank, 2),
    hotel_stay_id = p_hotel_stay_id,
    cost_id = p_cost_id
  where id = p_agreement_id;

  perform public.ledger_sync_agreement(p_agreement_id);
end;
$$;

-- Cancelar só um acordo sem nada pago: um acordo com pagamentos é história
-- contabilística e corrige-se, não se apaga. A linha da logística fica livre
-- para um acordo novo.
create or replace function public.ledger_cancel_agreement(p_agreement_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_agreement public.supplier_agreements%rowtype;
begin
  select * into v_agreement from public.supplier_agreements where id = p_agreement_id for update;
  if not found then
    raise exception 'Acordo não encontrado.' using errcode = 'P0001';
  end if;
  if v_agreement.status <> 'open' then
    raise exception 'Este acordo já está cancelado.' using errcode = 'P0001';
  end if;
  if public.ledger_agreement_paid(p_agreement_id) > 0 then
    raise exception 'Este acordo já tem pagamentos. Desligue-os primeiro.' using errcode = 'P0001';
  end if;

  if v_agreement.hotel_stay_id is not null then
    update public.pilgrimage_hotel_stays set paid_amount = 0 where id = v_agreement.hotel_stay_id;
  end if;
  if v_agreement.cost_id is not null then
    update public.pilgrimage_costs set paid_amount = 0 where id = v_agreement.cost_id;
  end if;

  update public.supplier_agreements
  set status = 'cancelled', hotel_stay_id = null, cost_id = null
  where id = p_agreement_id;
end;
$$;

revoke all on function public.ledger_update_agreement(uuid, text, text, numeric, numeric, uuid, uuid) from public, anon, authenticated;
revoke all on function public.ledger_cancel_agreement(uuid) from public, anon, authenticated;
grant execute on function public.ledger_update_agreement(uuid, text, text, numeric, numeric, uuid, uuid) to service_role;
grant execute on function public.ledger_cancel_agreement(uuid) to service_role;
