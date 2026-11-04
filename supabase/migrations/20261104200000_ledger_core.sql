-- Ledger: bank statement reconciliation (Banco Montepio) for /admin/contabilidade.
--
-- Only new tables; nothing existing is altered. Server routes use the service
-- role, so RLS is on with no policies and anon/authenticated have no grants.
--
-- Integrity rules enforced in the database (not only in app code):
--   * statement facts (date, amount, description, balance) are immutable;
--   * a movement can only be deleted while untouched (to undo a wrong import);
--   * the period is derived from the booking date;
--   * a closed month rejects any change to its movements, links and documents;
--   * one site payment / settlement can be linked to only one bank movement;
--   * every change is written to an append-only history (ledger_events).

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  iban text unique,
  provider text not null default 'montepio',
  currency text not null default 'EUR',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ledger_categories (
  code text primary key,
  label text not null,
  direction text not null check (direction in ('in', 'out', 'both')),
  requires_invoice boolean not null default false,
  requires_document boolean not null default false,
  sort integer not null default 100,
  active boolean not null default true
);

create table if not exists public.bank_import_batches (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.bank_accounts(id),
  source text not null check (source in ('xlsx', 'csv', 'enable_banking')),
  file_name text,
  file_sha256 text unique,
  imported_by text,
  period_from date,
  period_to date,
  rows_total integer not null default 0 check (rows_total >= 0),
  rows_new integer not null default 0 check (rows_new >= 0),
  rows_duplicate integer not null default 0 check (rows_duplicate >= 0),
  balance_ok boolean,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.bank_accounts(id),
  batch_id uuid references public.bank_import_batches(id),
  booking_date date not null,
  value_date date,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount numeric(12, 2) not null check (amount <> 0),
  currency text not null default 'EUR',
  description_raw text not null check (length(trim(description_raw)) > 0),
  balance_after numeric(14, 2),
  provider_tx_id text,
  fingerprint text not null unique,
  -- Same movement whatever the source (file export or bank API): booking date,
  -- amount and the start of the description without the bank's reference.
  match_key text,
  raw jsonb,
  parsed_kind text not null default 'other',
  counterparty_name text,
  category_code text references public.ledger_categories(code),
  status text not null default 'unreviewed'
    check (status in ('unreviewed', 'suggested', 'reconciled', 'ignored')),
  needs_document boolean not null default false,
  paper_document boolean not null default false,
  ignore_reason text,
  notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_transactions_reconciled_has_category
    check (status <> 'reconciled' or category_code is not null),
  constraint bank_transactions_ignored_has_reason
    check (status <> 'ignored' or length(trim(coalesce(ignore_reason, ''))) > 0)
);

create unique index if not exists bank_transactions_provider_tx_uidx
  on public.bank_transactions(account_id, provider_tx_id)
  where provider_tx_id is not null;
create index if not exists bank_transactions_period_status_idx
  on public.bank_transactions(period, status);
create index if not exists bank_transactions_match_idx
  on public.bank_transactions(account_id, booking_date, amount, match_key);
create index if not exists bank_transactions_booking_date_idx
  on public.bank_transactions(booking_date);
create index if not exists bank_transactions_open_idx
  on public.bank_transactions(booking_date)
  where status in ('unreviewed', 'suggested');

create table if not exists public.bank_transaction_links (
  id uuid primary key default gen_random_uuid(),
  bank_transaction_id uuid not null references public.bank_transactions(id) on delete cascade,
  target_type text not null check (target_type in (
    'donation', 'quota', 'pilgrimage_payment', 'store_order',
    'factpt_document', 'reduniq_settlement', 'expense_document', 'note'
  )),
  target_id text,
  amount numeric(12, 2) not null check (amount > 0),
  label text,
  method text not null default 'manual' check (method in ('rule', 'suggestion', 'manual', 'backfill')),
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists bank_transaction_links_tx_idx
  on public.bank_transaction_links(bank_transaction_id);
create unique index if not exists bank_transaction_links_same_target_uidx
  on public.bank_transaction_links(bank_transaction_id, target_type, target_id)
  where target_id is not null;
-- A site payment, FR or settlement is paid by exactly one bank movement.
create unique index if not exists bank_transaction_links_target_once_uidx
  on public.bank_transaction_links(target_type, target_id)
  where target_id is not null
    and target_type in ('donation', 'quota', 'pilgrimage_payment', 'store_order', 'factpt_document', 'reduniq_settlement');

create table if not exists public.expense_documents (
  id uuid primary key default gen_random_uuid(),
  bank_transaction_id uuid not null references public.bank_transactions(id) on delete cascade,
  storage_path text not null unique,
  file_name text,
  mime_type text,
  size_bytes integer check (size_bytes is null or size_bytes > 0),
  sha256 text,
  supplier text,
  doc_number text,
  doc_date date,
  amount numeric(12, 2),
  vat_amount numeric(12, 2),
  withholding_amount numeric(12, 2),
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index if not exists expense_documents_tx_idx
  on public.expense_documents(bank_transaction_id);

create table if not exists public.counterparty_aliases (
  id uuid primary key default gen_random_uuid(),
  alias_normalized text not null unique,
  display_name text not null,
  member_id uuid,
  email text,
  nif text,
  default_category_code text references public.ledger_categories(code),
  times_confirmed integer not null default 0 check (times_confirmed >= 0),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  pattern text not null check (length(trim(pattern)) >= 3),
  match_type text not null default 'contains' check (match_type in ('prefix', 'contains')),
  direction text check (direction in ('in', 'out')),
  category_code text not null references public.ledger_categories(code),
  priority integer not null default 100,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.ledger_periods (
  period text primary key check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_by text,
  closed_at timestamptz,
  export_path text,
  checks jsonb,
  constraint ledger_periods_closed_has_author
    check (status <> 'closed' or (closed_by is not null and closed_at is not null))
);

-- Append-only history of everything that happens to a movement.
create table if not exists public.ledger_events (
  id bigint generated always as identity primary key,
  bank_transaction_id uuid not null,
  action text not null,
  actor text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ledger_events_tx_idx
  on public.ledger_events(bank_transaction_id, created_at);

-- ---------------------------------------------------------------------------
-- Functions and triggers
-- ---------------------------------------------------------------------------

create or replace function public.ledger_assert_period_open(p_period text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.ledger_periods where period = p_period and status = 'closed') then
    raise exception 'O mês % está fechado e não pode ser alterado.', p_period
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.ledger_guard_bank_transactions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.ledger_assert_period_open(old.period);
    if old.status <> 'unreviewed'
       or exists (select 1 from public.bank_transaction_links where bank_transaction_id = old.id)
       or exists (select 1 from public.expense_documents where bank_transaction_id = old.id) then
      raise exception 'Só é possível apagar movimentos ainda por tratar e sem ligações. Use "Ignorar".'
        using errcode = 'P0001';
    end if;
    return old;
  end if;

  new.period := to_char(new.booking_date, 'YYYY-MM');
  perform public.ledger_assert_period_open(new.period);

  if tg_op = 'UPDATE' then
    if new.account_id is distinct from old.account_id
       or new.booking_date is distinct from old.booking_date
       or new.value_date is distinct from old.value_date
       or new.amount is distinct from old.amount
       or new.description_raw is distinct from old.description_raw
       or (old.balance_after is not null and new.balance_after is distinct from old.balance_after)
       or new.fingerprint is distinct from old.fingerprint
       or (old.provider_tx_id is not null and new.provider_tx_id is distinct from old.provider_tx_id) then
      raise exception 'Os dados do extrato (data, valor, descrição, saldo) não podem ser alterados.'
        using errcode = 'P0001';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists ledger_guard_bank_transactions on public.bank_transactions;
create trigger ledger_guard_bank_transactions
  before insert or update or delete on public.bank_transactions
  for each row execute function public.ledger_guard_bank_transactions();

create or replace function public.ledger_guard_children()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_period text;
begin
  select period into v_period
  from public.bank_transactions
  where id = coalesce(new.bank_transaction_id, old.bank_transaction_id);
  if v_period is not null then
    perform public.ledger_assert_period_open(v_period);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists ledger_guard_links on public.bank_transaction_links;
create trigger ledger_guard_links
  before insert or update or delete on public.bank_transaction_links
  for each row execute function public.ledger_guard_children();

drop trigger if exists ledger_guard_expense_documents on public.expense_documents;
create trigger ledger_guard_expense_documents
  before insert or update or delete on public.expense_documents
  for each row execute function public.ledger_guard_children();

-- History: movement changes.
create or replace function public.ledger_log_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ledger_events (bank_transaction_id, action, actor, after)
    values (new.id, 'imported', new.reviewed_by,
            jsonb_build_object('batch_id', new.batch_id, 'category_code', new.category_code, 'status', new.status));
    return new;
  end if;
  if tg_op = 'DELETE' then
    insert into public.ledger_events (bank_transaction_id, action, actor, before)
    values (old.id, 'deleted', old.reviewed_by,
            jsonb_build_object('booking_date', old.booking_date, 'amount', old.amount, 'description_raw', old.description_raw));
    return old;
  end if;
  if (new.status, new.category_code, new.notes, new.needs_document, new.paper_document, new.ignore_reason, new.counterparty_name)
     is distinct from
     (old.status, old.category_code, old.notes, old.needs_document, old.paper_document, old.ignore_reason, old.counterparty_name) then
    insert into public.ledger_events (bank_transaction_id, action, actor, before, after)
    values (new.id, 'updated', new.reviewed_by,
            jsonb_build_object('status', old.status, 'category_code', old.category_code, 'notes', old.notes,
                               'needs_document', old.needs_document, 'paper_document', old.paper_document,
                               'ignore_reason', old.ignore_reason, 'counterparty_name', old.counterparty_name),
            jsonb_build_object('status', new.status, 'category_code', new.category_code, 'notes', new.notes,
                               'needs_document', new.needs_document, 'paper_document', new.paper_document,
                               'ignore_reason', new.ignore_reason, 'counterparty_name', new.counterparty_name));
  end if;
  return new;
end;
$$;

drop trigger if exists ledger_log_transaction on public.bank_transactions;
create trigger ledger_log_transaction
  after insert or update or delete on public.bank_transactions
  for each row execute function public.ledger_log_transaction();

-- History: links and documents.
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
  insert into public.ledger_events (bank_transaction_id, action, actor, before, after)
  values (
    (v_row ->> 'bank_transaction_id')::uuid,
    tg_table_name || '.' || lower(tg_op),
    v_actor,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists ledger_log_links on public.bank_transaction_links;
create trigger ledger_log_links
  after insert or update or delete on public.bank_transaction_links
  for each row execute function public.ledger_log_child();

drop trigger if exists ledger_log_expense_documents on public.expense_documents;
create trigger ledger_log_expense_documents
  after insert or update or delete on public.expense_documents
  for each row execute function public.ledger_log_child();

-- History is append-only.
create or replace function public.ledger_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'O histórico da contabilidade não pode ser alterado nem apagado.'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists ledger_events_append_only on public.ledger_events;
create trigger ledger_events_append_only
  before update or delete on public.ledger_events
  for each row execute function public.ledger_events_append_only();

-- Atomic import: the batch and all its movements are saved together or not at
-- all. Lines already stored (same fingerprint) are skipped, so a statement that
-- overlaps an earlier one only adds what is new.
create or replace function public.ledger_import_statement(p_batch jsonb, p_rows jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_account uuid := (p_batch ->> 'account_id')::uuid;
  v_batch_id uuid;
  v_total integer := jsonb_array_length(p_rows);
  v_new integer;
begin
  insert into public.bank_import_batches (
    account_id, source, file_name, file_sha256, imported_by,
    period_from, period_to, rows_total, balance_ok, warnings
  ) values (
    v_account, p_batch ->> 'source', p_batch ->> 'file_name', p_batch ->> 'file_sha256', p_batch ->> 'imported_by',
    (p_batch ->> 'period_from')::date, (p_batch ->> 'period_to')::date, v_total,
    (p_batch ->> 'balance_ok')::boolean, coalesce(p_batch -> 'warnings', '[]'::jsonb)
  )
  returning id into v_batch_id;

  with numbered as (
    select r, ord,
      (r ->> 'booking_date')::date as d,
      (r ->> 'amount')::numeric as a,
      nullif(r ->> 'match_key', '') as k
    from jsonb_array_elements(p_rows) with ordinality as e(r, ord)
  ), ranked as (
    select *, row_number() over (partition by d, a, k order by ord) as occurrence
    from numbered
  ), incoming as (
    -- Skip a line already stored from the other source (file vs bank API):
    -- keep only occurrences beyond those that already exist for the same key.
    select r from ranked
    where k is null or occurrence > (
      select count(*) from public.bank_transactions t
      where t.account_id = v_account and t.booking_date = ranked.d
        and t.amount = ranked.a and t.match_key = ranked.k
    )
  ), inserted as (
    insert into public.bank_transactions (
      account_id, batch_id, booking_date, value_date, period, amount, description_raw,
      balance_after, fingerprint, match_key, provider_tx_id, raw, parsed_kind, counterparty_name, category_code,
      status, needs_document
    )
    select
      v_account, v_batch_id, (r ->> 'booking_date')::date, nullif(r ->> 'value_date', '')::date,
      to_char((r ->> 'booking_date')::date, 'YYYY-MM'), (r ->> 'amount')::numeric, r ->> 'description_raw',
      nullif(r ->> 'balance_after', '')::numeric, r ->> 'fingerprint', nullif(r ->> 'match_key', ''),
      nullif(r ->> 'provider_tx_id', ''),
      r -> 'raw', r ->> 'parsed_kind',
      nullif(r ->> 'counterparty_name', ''), nullif(r ->> 'category_code', ''),
      coalesce(r ->> 'status', 'unreviewed'), coalesce((r ->> 'needs_document')::boolean, false)
    from incoming
    -- Both the fingerprint and (account_id, provider_tx_id) have unique indexes.
    -- This also handles duplicates inside the same batch atomically.
    on conflict do nothing
    returning 1
  )
  select count(*) into v_new from inserted;

  update public.bank_import_batches
  set rows_new = v_new, rows_duplicate = v_total - v_new
  where id = v_batch_id;

  return jsonb_build_object('batch_id', v_batch_id, 'rows_new', v_new, 'rows_duplicate', v_total - v_new);
end;
$$;

-- The fiscal link and the movement status must change in the same transaction.
-- This function is called only after the API has checked FACT.pt and pending
-- site payments. The row lock prevents two admins from approving at once.
create or replace function public.ledger_approve_movement(
  p_transaction_id uuid,
  p_category_code text,
  p_invoice_ref text,
  p_invoice_method text,
  p_actor text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_movement public.bank_transactions%rowtype;
  v_category public.ledger_categories%rowtype;
  v_linked_payment text;
begin
  select * into v_movement from public.bank_transactions
  where id = p_transaction_id for update;
  if not found then
    raise exception 'Movimento não encontrado.' using errcode = 'P0001';
  end if;
  if v_movement.status not in ('unreviewed', 'suggested') then
    raise exception 'O movimento já foi tratado.' using errcode = 'P0001';
  end if;

  select * into v_category from public.ledger_categories
  where code = p_category_code and active = true;
  if not found then
    raise exception 'Categoria inválida.' using errcode = 'P0001';
  end if;
  if v_category.direction <> 'both'
     and (v_movement.amount > 0) <> (v_category.direction = 'in') then
    raise exception 'Categoria incompatível com o sentido do movimento.' using errcode = 'P0001';
  end if;
  if v_movement.amount > 0 and v_category.requires_invoice
     and nullif(p_invoice_ref, '') is null then
    raise exception 'Falta a fatura-recibo.' using errcode = 'P0001';
  end if;
  if p_invoice_ref is not null and (v_movement.amount <= 0 or not v_category.requires_invoice) then
    raise exception 'A categoria não aceita uma FR individual.' using errcode = 'P0001';
  end if;
  if p_invoice_ref is not null and p_invoice_ref !~ (
    '^FR ' || to_char(v_movement.booking_date, 'YYYY') ||
    case p_category_code
      when 'doacao' then 'D'
      when 'peregrinacao' then 'D'
      when 'quota' then 'Q'
      when 'loja' then 'L'
      else '?' end || '/[1-9][0-9]*$'
  ) then
    raise exception 'Série ou formato da FR inválido.' using errcode = 'P0001';
  end if;

  select target_id into v_linked_payment from public.bank_transaction_links
  where bank_transaction_id = p_transaction_id and target_type = 'pilgrimage_payment'
  limit 1;
  if v_linked_payment is not null and (
    p_category_code <> 'peregrinacao' or not exists (
      select 1 from public.factpt_documents d
      where d.environment = 'production' and d.source_table = 'pilgrimage_payments'
        and d.source_id = v_linked_payment::uuid and d.factpt_number = p_invoice_ref
        and d.amount = v_movement.amount
        and d.status in ('issued', 'email_failed')
    )
  ) then
    raise exception 'A FR deve pertencer ao pagamento de peregrinação já associado.' using errcode = 'P0001';
  end if;

  if p_invoice_ref is not null then
    insert into public.bank_transaction_links (
      bank_transaction_id, target_type, target_id, label, amount, method, created_by
    ) values (
      p_transaction_id, 'factpt_document', p_invoice_ref, p_invoice_ref,
      abs(v_movement.amount), p_invoice_method, p_actor
    );
  end if;

  update public.bank_transactions
  set status = 'reconciled', category_code = p_category_code,
      needs_document = v_category.requires_document,
      ignore_reason = null, reviewed_by = p_actor, reviewed_at = now()
  where id = p_transaction_id;
end;
$$;

create or replace function public.ledger_reopen_movement(
  p_transaction_id uuid,
  p_actor text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_movement public.bank_transactions%rowtype;
begin
  select * into v_movement from public.bank_transactions
  where id = p_transaction_id for update;
  if not found then
    raise exception 'Movimento não encontrado.' using errcode = 'P0001';
  end if;
  delete from public.bank_transaction_links
  where bank_transaction_id = p_transaction_id
    and target_type = 'factpt_document'
    and method in ('manual', 'rule', 'suggestion');
  update public.bank_transactions
  set status = case when v_movement.category_code is null then 'unreviewed' else 'suggested' end,
      ignore_reason = null, reviewed_by = p_actor, reviewed_at = now()
  where id = p_transaction_id;
end;
$$;

-- A bank transfer assigned to a booking follows the same paid-payment trigger
-- as the existing site flow. All records below commit or roll back together.
create or replace function public.ledger_register_pilgrimage_transfer(
  p_transaction_id uuid,
  p_booking_id uuid,
  p_payment_id uuid,
  p_admin_user_id uuid,
  p_actor text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_movement public.bank_transactions%rowtype;
  v_booking public.bookings%rowtype;
  v_payment public.pilgrimage_payments%rowtype;
  v_deposit numeric;
  v_pilgrims integer;
  v_total_paid numeric;
  v_required_deposit numeric;
  v_confirmed boolean;
  v_title text;
  v_holder text;
begin
  select * into v_movement from public.bank_transactions
  where id = p_transaction_id for update;
  if not found or v_movement.amount <= 0 or v_movement.status not in ('unreviewed', 'suggested') then
    raise exception 'Movimento indisponível para associar a uma reserva.' using errcode = 'P0001';
  end if;
  perform public.ledger_assert_period_open(v_movement.period);
  if exists (select 1 from public.bank_transaction_links where bank_transaction_id = p_transaction_id) then
    raise exception 'Este movimento já está associado. Reveja as ligações existentes.' using errcode = 'P0001';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or lower(coalesce(v_booking.status, '')) in ('canceled', 'cancelled')
     or v_booking.pilgrimage_id is null then
    raise exception 'Reserva indisponível.' using errcode = 'P0001';
  end if;
  select nome into v_holder from public.membros where id = v_booking.user_id;
  -- Same fallback as the FACT.pt snapshot: bookings without a member record
  -- use the first pilgrim's name.
  if nullif(trim(coalesce(v_holder, '')), '') is null then
    select full_name into v_holder from public.pilgrims
    where booking_id = p_booking_id order by created_at asc limit 1;
  end if;
  select coalesce(sum(amount), 0) into v_total_paid
  from public.pilgrimage_payments
  where booking_id = p_booking_id and not coalesce(deleted, false)
    and status in ('verified', 'succeeded', 'paid', 'manual');
  if coalesce(v_booking.total_amount, 0) > 0
     and v_total_paid + v_movement.amount > v_booking.total_amount + 0.01
     and not exists (
       select 1 from public.pilgrimage_payments already
       where already.id = p_payment_id and already.status in ('verified', 'manual', 'succeeded', 'paid')
     ) then
    raise exception 'O valor excede o saldo da reserva. Reveja a reserva antes de faturar.' using errcode = 'P0001';
  end if;

  if p_payment_id is not null then
    select * into v_payment from public.pilgrimage_payments
    where id = p_payment_id for update;
    if not found or v_payment.booking_id <> p_booking_id
       or v_payment.amount <> v_movement.amount
       or v_payment.method <> 'bank_transfer'
       or coalesce(v_payment.deleted, false) then
      raise exception 'O pagamento escolhido não corresponde a esta transferência.' using errcode = 'P0001';
    end if;
    -- Already registered on the pilgrimage page (FR issued there): only link
    -- the bank movement to it. No new payment, no status change, no second FR.
    if v_payment.status in ('verified', 'manual', 'succeeded', 'paid') then
      if not exists (select 1 from public.factpt_documents d where d.environment = 'production'
                     and d.source_table = 'pilgrimage_payments' and d.source_id = v_payment.id) then
        raise exception 'Este pagamento não tem pedido de FR. Reveja-o em Faturação.' using errcode = 'P0001';
      end if;
      select title into v_title from public.pilgrimages where id = v_booking.pilgrimage_id;
      insert into public.bank_transaction_links (
        bank_transaction_id, target_type, target_id, amount, label, method, created_by
      ) values (
        p_transaction_id, 'pilgrimage_payment', v_payment.id::text, v_movement.amount,
        coalesce(v_title, 'Peregrinação') || ' · ' || coalesce(v_holder, 'reserva ' || left(p_booking_id::text, 8)),
        'manual', p_actor
      );
      update public.bank_transactions
      set category_code = 'peregrinacao', status = 'suggested', reviewed_by = p_actor, reviewed_at = now()
      where id = p_transaction_id;
      return v_payment.id;
    end if;
    if v_payment.status not in ('pending', 'pending_verification', 'verifying') then
      raise exception 'O pagamento escolhido não está pendente.' using errcode = 'P0001';
    end if;
    if nullif(trim(coalesce(v_payment.billing_name, v_holder, '')), '') is null then
      raise exception 'Falta o nome do titular fiscal da reserva.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.factpt_documents where environment = 'production'
               and source_table = 'pilgrimage_payments' and source_id = p_payment_id) then
      raise exception 'Este pagamento já tem um documento FACT.pt.' using errcode = 'P0001';
    end if;
    update public.pilgrimage_payments
    set status = 'verified', verified_at = now(), verified_by = p_admin_user_id
    where id = p_payment_id;
  else
    if nullif(trim(coalesce(v_holder, '')), '') is null then
      raise exception 'Falta o nome do titular fiscal da reserva.' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.pilgrimage_payments p
      where p.booking_id = p_booking_id and p.amount = v_movement.amount
        and p.method = 'bank_transfer' and not coalesce(p.deleted, false)
    ) then
      raise exception 'Já existe um pagamento por transferência com o mesmo valor nesta reserva. Escolha-o ou reveja o caso.' using errcode = 'P0001';
    end if;
    insert into public.pilgrimage_payments (
      booking_id, user_id, amount, method, status, notes, verified_at, verified_by
    ) values (
      p_booking_id, v_booking.user_id, v_movement.amount, 'bank_transfer', 'verified',
      'Movimento bancário ' || p_transaction_id::text, now(), p_admin_user_id
    ) returning * into v_payment;
  end if;

  if not exists (
    select 1 from public.factpt_documents d
    where d.environment = 'production' and d.source_table = 'pilgrimage_payments'
      and d.source_id = v_payment.id
  ) then
    raise exception 'O pedido de FR não foi criado pela FACT.pt. Nenhum pagamento foi registado.' using errcode = 'P0001';
  end if;

  select title into v_title from public.pilgrimages where id = v_booking.pilgrimage_id;

  insert into public.bank_transaction_links (
    bank_transaction_id, target_type, target_id, amount, label, method, created_by
  ) values (
    p_transaction_id, 'pilgrimage_payment', v_payment.id::text,
    v_movement.amount,
    coalesce(v_title, 'Peregrinação') || ' · ' || coalesce(v_holder, 'reserva ' || left(p_booking_id::text, 8)),
    'manual', p_actor
  );

  update public.bank_transactions
  set category_code = 'peregrinacao', status = 'suggested',
      reviewed_by = p_actor, reviewed_at = now()
  where id = p_transaction_id;

  select coalesce(pilgrimage.deposit_value, 0) into v_deposit
  from public.pilgrimages pilgrimage where id = v_booking.pilgrimage_id;
  select greatest(1, count(*)) into v_pilgrims
  from public.pilgrims where booking_id = p_booking_id;
  select coalesce(sum(amount), 0) into v_total_paid
  from public.pilgrimage_payments
  where booking_id = p_booking_id and not coalesce(deleted, false)
    and status in ('verified', 'succeeded', 'paid', 'manual');
  v_required_deposit := v_deposit * v_pilgrims;
  v_confirmed := v_total_paid >= v_required_deposit - 0.01
    or (coalesce(v_booking.total_amount, 0) > 0
        and v_total_paid >= v_booking.total_amount - 0.01);
  update public.bookings
  set paid_amount = v_total_paid,
      status = case when v_confirmed then 'confirmed' else 'pending' end,
      deposit_confirmed_at = case when v_confirmed then coalesce(deposit_confirmed_at, now()) else deposit_confirmed_at end,
      updated_at = now()
  where id = p_booking_id;
  perform public.recalculate_pilgrimage_vacancies(v_booking.pilgrimage_id);
  return v_payment.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.bank_accounts enable row level security;
alter table public.ledger_categories enable row level security;
alter table public.bank_import_batches enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.bank_transaction_links enable row level security;
alter table public.expense_documents enable row level security;
alter table public.counterparty_aliases enable row level security;
alter table public.categorization_rules enable row level security;
alter table public.ledger_periods enable row level security;
alter table public.ledger_events enable row level security;

revoke all on public.bank_accounts, public.ledger_categories, public.bank_import_batches,
  public.bank_transactions, public.bank_transaction_links, public.expense_documents,
  public.counterparty_aliases, public.categorization_rules, public.ledger_periods,
  public.ledger_events
  from anon, authenticated;

-- Supabase projects can disable automatic Data API grants. The server uses
-- service_role for these tables, so grant it explicitly in the migration.
grant select, insert, update, delete on public.bank_accounts, public.ledger_categories,
  public.bank_import_batches, public.bank_transactions, public.bank_transaction_links,
  public.expense_documents, public.counterparty_aliases, public.categorization_rules,
  public.ledger_periods to service_role;
grant select, insert on public.ledger_events to service_role;
grant usage, select on sequence public.ledger_events_id_seq to service_role;

revoke all on function public.ledger_assert_period_open(text) from public, anon, authenticated;
revoke all on function public.ledger_import_statement(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.ledger_approve_movement(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.ledger_reopen_movement(uuid, text) from public, anon, authenticated;
revoke all on function public.ledger_register_pilgrimage_transfer(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.ledger_guard_bank_transactions() from public, anon, authenticated;
revoke all on function public.ledger_guard_children() from public, anon, authenticated;
revoke all on function public.ledger_log_transaction() from public, anon, authenticated;
revoke all on function public.ledger_log_child() from public, anon, authenticated;
revoke all on function public.ledger_events_append_only() from public, anon, authenticated;
revoke all on sequence public.ledger_events_id_seq from anon, authenticated;
grant execute on function public.ledger_assert_period_open(text) to service_role;
grant execute on function public.ledger_import_statement(jsonb, jsonb) to service_role;
grant execute on function public.ledger_approve_movement(uuid, text, text, text, text) to service_role;
grant execute on function public.ledger_reopen_movement(uuid, text) to service_role;
grant execute on function public.ledger_register_pilgrimage_transfer(uuid, uuid, uuid, uuid, text) to service_role;

-- Private bucket for expense documents (invoices, receipts, recibos verdes).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ledger-documents', 'ledger-documents', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------

insert into public.bank_accounts (label, provider)
select 'Montepio — conta principal', 'montepio'
where not exists (select 1 from public.bank_accounts where provider = 'montepio');

insert into public.ledger_categories (code, label, direction, requires_invoice, requires_document, sort) values
  ('doacao',               'Doação',                 'in',   true,  false, 10),
  ('quota',                'Quota',                  'in',   true,  false, 20),
  ('peregrinacao',         'Peregrinação',           'in',   true,  false, 30),
  ('loja',                 'Loja',                   'in',   true,  false, 40),
  ('liquidacao_reduniq',   'Liquidação Reduniq',     'in',   false, false, 50),
  ('liquidacao_stripe',    'Liquidação Stripe',      'in',   false, false, 55),
  ('fecho_tpa',            'Fecho TPA / MB Way',     'in',   false, false, 60),
  ('outra_entrada',        'Outra entrada',          'in',   false, false, 90),
  ('comissao_reduniq',     'Comissão Reduniq',       'out',  false, false, 110),
  ('comissao_bancaria',    'Comissão bancária',      'out',  false, false, 120),
  ('imposto_selo',         'Imposto do selo',        'out',  false, false, 130),
  ('software',             'Software e serviços',    'out',  false, true,  140),
  ('comunicacoes',         'Comunicações',           'out',  false, true,  145),
  ('contabilidade',        'Contabilidade',          'out',  false, true,  150),
  ('viagem',               'Viagem e transportes',   'out',  false, true,  160),
  ('alojamento',           'Alojamento e refeições', 'out',  false, true,  170),
  ('remuneracao',          'Remuneração',            'out',  false, true,  175),
  ('recibos_verdes',       'Recibos verdes',         'out',  false, true,  180),
  ('fornecedores',         'Fornecedores',           'out',  false, true,  185),
  ('devolucao',            'Devolução',              'both', false, false, 190),
  ('outra_despesa',        'Outra despesa',          'out',  false, true,  199),
  ('transferencia_interna','Transferência interna',  'both', false, false, 200)
on conflict (code) do nothing;
