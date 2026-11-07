-- A proforma from a hotel or restaurant: what was agreed for a pilgrimage, and
-- the bank payments that pay it off. The logistics "already paid" follows them.

create table if not exists public.supplier_agreements (
  id uuid primary key default gen_random_uuid(),
  pilgrimage_id uuid not null references public.pilgrimages(id) on delete restrict,
  hotel_stay_id uuid references public.pilgrimage_hotel_stays(id) on delete set null,
  cost_id uuid references public.pilgrimage_costs(id) on delete set null,
  supplier text not null check (char_length(trim(supplier)) > 0),
  description text,
  total_amount numeric(12, 2) not null check (total_amount > 0),
  paid_outside_bank numeric(12, 2) not null default 0 check (paid_outside_bank >= 0),
  status text not null default 'open' check (status in ('open', 'cancelled')),
  notes text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_agreements_one_logistics_line check (hotel_stay_id is null or cost_id is null)
);
create unique index if not exists supplier_agreements_stay_uidx on public.supplier_agreements(hotel_stay_id) where hotel_stay_id is not null;
create unique index if not exists supplier_agreements_cost_uidx on public.supplier_agreements(cost_id) where cost_id is not null;
create index if not exists supplier_agreements_pilgrimage_idx on public.supplier_agreements(pilgrimage_id);

alter table public.supplier_agreements enable row level security;
revoke all on public.supplier_agreements from anon, authenticated;
grant select, insert, update on public.supplier_agreements to service_role;

-- The proforma and the supplier's final invoice belong to the agreement, not to a payment.
alter table public.expense_documents alter column bank_transaction_id drop not null;
alter table public.expense_documents
  add column if not exists agreement_id uuid references public.supplier_agreements(id) on delete cascade;
alter table public.expense_documents drop constraint if exists expense_documents_has_owner;
alter table public.expense_documents
  add constraint expense_documents_has_owner check (bank_transaction_id is not null or agreement_id is not null);
create index if not exists expense_documents_agreement_idx on public.expense_documents(agreement_id) where agreement_id is not null;

alter table public.bank_transaction_links drop constraint if exists bank_transaction_links_target_type_check;
alter table public.bank_transaction_links add constraint bank_transaction_links_target_type_check check (target_type in (
  'donation', 'quota', 'pilgrimage_payment', 'store_order', 'factpt_document',
  'reduniq_settlement', 'expense_document', 'note', 'agreement'
));

-- History covers agreements too, not only bank movements.
alter table public.ledger_events alter column bank_transaction_id drop not null;
alter table public.ledger_events add column if not exists agreement_id uuid;
alter table public.ledger_events drop constraint if exists ledger_events_has_subject;
alter table public.ledger_events
  add constraint ledger_events_has_subject check (bank_transaction_id is not null or agreement_id is not null);

create or replace function public.ledger_log_child()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_row jsonb;
  v_actor text;
begin
  v_row := to_jsonb(coalesce(new, old));
  v_actor := coalesce(v_row ->> 'created_by', v_row ->> 'uploaded_by');
  insert into public.ledger_events (bank_transaction_id, agreement_id, action, actor, before, after)
  values (
    (v_row ->> 'bank_transaction_id')::uuid,
    case when tg_table_name = 'supplier_agreements' then (v_row ->> 'id')::uuid else (v_row ->> 'agreement_id')::uuid end,
    tg_table_name || '.' || lower(tg_op),
    v_actor,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists ledger_log_agreements on public.supplier_agreements;
create trigger ledger_log_agreements
  after insert or update on public.supplier_agreements
  for each row execute function public.ledger_log_child();

create or replace function public.ledger_agreement_paid(p_agreement_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(a.paid_outside_bank, 0) + coalesce((
    select sum(l.amount) from public.bank_transaction_links l
    where l.target_type = 'agreement' and l.target_id = a.id::text
  ), 0)
  from public.supplier_agreements a where a.id = p_agreement_id;
$$;

-- The logistics line shows what the bank says was paid; nobody types it again.
create or replace function public.ledger_sync_agreement(p_agreement_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_agreement public.supplier_agreements%rowtype;
  v_paid numeric := public.ledger_agreement_paid(p_agreement_id);
begin
  select * into v_agreement from public.supplier_agreements where id = p_agreement_id;
  if v_agreement.hotel_stay_id is not null then
    update public.pilgrimage_hotel_stays set paid_amount = v_paid where id = v_agreement.hotel_stay_id;
  elsif v_agreement.cost_id is not null then
    update public.pilgrimage_costs set paid_amount = v_paid where id = v_agreement.cost_id;
  end if;
  update public.supplier_agreements set updated_at = now() where id = p_agreement_id;
end;
$$;

create or replace function public.ledger_link_agreement_payment(
  p_transaction_id uuid,
  p_agreement_id uuid,
  p_actor text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_movement public.bank_transactions%rowtype;
  v_agreement public.supplier_agreements%rowtype;
  v_title text;
begin
  select * into v_movement from public.bank_transactions where id = p_transaction_id for update;
  if not found or v_movement.amount >= 0 or v_movement.status = 'ignored' then
    raise exception 'Só uma despesa pode pagar um acordo.' using errcode = 'P0001';
  end if;
  perform public.ledger_assert_period_open(v_movement.period);
  select * into v_agreement from public.supplier_agreements where id = p_agreement_id for update;
  if not found or v_agreement.status <> 'open' then
    raise exception 'Acordo indisponível.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.bank_transaction_links where bank_transaction_id = p_transaction_id and target_type = 'agreement') then
    raise exception 'Este pagamento já está ligado a um acordo.' using errcode = 'P0001';
  end if;
  if public.ledger_agreement_paid(p_agreement_id) + abs(v_movement.amount) > v_agreement.total_amount + 0.01 then
    raise exception 'Este pagamento ultrapassa o total do acordo (% €). Reveja o valor da proforma.', v_agreement.total_amount using errcode = 'P0001';
  end if;

  select title into v_title from public.pilgrimages where id = v_agreement.pilgrimage_id;
  insert into public.bank_transaction_links (bank_transaction_id, target_type, target_id, amount, label, method, created_by)
  values (p_transaction_id, 'agreement', p_agreement_id::text, abs(v_movement.amount),
          v_agreement.supplier || ' · ' || coalesce(v_title, 'Peregrinação'), 'manual', p_actor);
  perform public.ledger_sync_agreement(p_agreement_id);
end;
$$;

create or replace function public.ledger_unlink_agreement_payment(
  p_transaction_id uuid,
  p_actor text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_agreement_id text;
begin
  delete from public.bank_transaction_links
  where bank_transaction_id = p_transaction_id and target_type = 'agreement'
  returning target_id into v_agreement_id;
  if v_agreement_id is null then
    raise exception 'Este pagamento não está ligado a nenhum acordo.' using errcode = 'P0001';
  end if;
  perform public.ledger_sync_agreement(v_agreement_id::uuid);
end;
$$;

revoke all on function public.ledger_agreement_paid(uuid) from public, anon, authenticated;
revoke all on function public.ledger_sync_agreement(uuid) from public, anon, authenticated;
revoke all on function public.ledger_link_agreement_payment(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.ledger_unlink_agreement_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.ledger_agreement_paid(uuid) to service_role;
grant execute on function public.ledger_sync_agreement(uuid) to service_role;
grant execute on function public.ledger_link_agreement_payment(uuid, uuid, text) to service_role;
grant execute on function public.ledger_unlink_agreement_payment(uuid, text) to service_role;
