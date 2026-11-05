-- Read-only copy of FACT.pt documents, so invoices issued by hand are visible,
-- and the path to issue a donation FR for a bank transfer through the app.

create table if not exists public.factpt_remote_documents (
  remote_id text primary key,
  number text not null,
  doc_type text not null,
  doc_date date not null,
  gross numeric(12, 2) not null,
  payment_status text,
  client_id text,
  client_name text,
  client_snapshot jsonb,
  identifier_id text,
  permanent_url text,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists factpt_remote_documents_match_idx
  on public.factpt_remote_documents(gross, doc_date);
create index if not exists factpt_remote_documents_number_idx
  on public.factpt_remote_documents(number);

alter table public.factpt_remote_documents enable row level security;
revoke all on public.factpt_remote_documents from anon, authenticated;
grant select, insert, update on public.factpt_remote_documents to service_role;

-- Off until set. Movements before this date keep their hand-issued FR: the app
-- must never issue a second one for them.
alter table public.bank_accounts add column if not exists app_donation_fr_from date;

-- One donation per bank movement, whatever happens above the database.
create unique index if not exists donations_bank_transaction_uidx
  on public.donations ((metadata ->> 'bank_transaction_id'))
  where metadata ? 'bank_transaction_id';

create or replace function public.ledger_register_donation_transfer(
  p_transaction_id uuid,
  p_donor_name text,
  p_donor_email text,
  p_donor_nif text,
  p_donor_address text,
  p_donor_zip text,
  p_donor_city text,
  p_donor_country text,
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
  v_nif text := nullif(regexp_replace(coalesce(p_donor_nif, ''), '\D', '', 'g'), '');
  v_donation_id uuid;
begin
  select * into v_movement from public.bank_transactions
  where id = p_transaction_id for update;
  if not found or v_movement.amount <= 0 or v_movement.status not in ('unreviewed', 'suggested') then
    raise exception 'Movimento indisponível para registar como doação.' using errcode = 'P0001';
  end if;
  perform public.ledger_assert_period_open(v_movement.period);
  if exists (select 1 from public.bank_transaction_links where bank_transaction_id = p_transaction_id) then
    raise exception 'Este movimento já está associado. Reveja as ligações existentes.' using errcode = 'P0001';
  end if;

  select app_donation_fr_from into v_from from public.bank_accounts where id = v_movement.account_id;
  if v_from is null or v_movement.booking_date < v_from then
    raise exception 'A emissão pela app não está ativa para movimentos desta data. A FR destes movimentos é emitida na FACT.pt.' using errcode = 'P0001';
  end if;

  if nullif(trim(coalesce(p_donor_name, '')), '') is null
     or nullif(trim(coalesce(p_donor_email, '')), '') is null
     or nullif(trim(coalesce(p_donor_address, '')), '') is null
     or nullif(trim(coalesce(p_donor_zip, '')), '') is null
     or nullif(trim(coalesce(p_donor_city, '')), '') is null
     or nullif(trim(coalesce(p_donor_country, '')), '') is null then
    raise exception 'Faltam dados fiscais do doador.' using errcode = 'P0001';
  end if;

  insert into public.donations (
    amount_cents, currency, method, status, description, external_reference,
    donor_name, donor_email, donor_nif, donor_address, donor_zip, donor_city, donor_country,
    receipt_required, receipt_status, reviewed_at, reviewed_by, metadata
  ) values (
    round(v_movement.amount * 100)::integer, 'EUR', 'bank_transfer', 'succeeded',
    'Doação por transferência bancária', 'BANK-' || left(p_transaction_id::text, 8),
    trim(p_donor_name), lower(trim(p_donor_email)), v_nif, trim(p_donor_address),
    trim(p_donor_zip), trim(p_donor_city), upper(trim(p_donor_country)),
    v_nif is not null, case when v_nif is null then 'not_required' else 'pending' end,
    now(), p_admin_user_id,
    jsonb_build_object(
      'confirmed_via', 'contabilidade',
      'bank_transaction_id', p_transaction_id::text,
      'taxIdRequested', v_nif is not null
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
    'Doação · ' || trim(p_donor_name), 'manual', p_actor
  );

  update public.bank_transactions
  set category_code = 'doacao', status = 'suggested', reviewed_by = p_actor, reviewed_at = now()
  where id = p_transaction_id;

  return v_donation_id;
end;
$$;

revoke all on function public.ledger_register_donation_transfer(uuid, text, text, text, text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.ledger_register_donation_transfer(uuid, text, text, text, text, text, text, text, uuid, text) to service_role;
