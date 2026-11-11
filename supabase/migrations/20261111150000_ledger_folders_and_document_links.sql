-- Contabilidade: pastas criadas pelo admin, um só tipo de ficheiro e ligações
-- de cada ficheiro a vários movimentos e a outras coisas da app.
--
-- Aditiva: nenhuma linha existente é apagada. O expense_documents.bank_transaction_id
-- de sempre continua a ser escrito e lido (é o "movimento principal"); um trigger
-- copia-o para ledger_document_links, que passa a ser a lista completa.
-- Ligar ficheiros nunca escreve em pilgrimage_payments nem em factpt_documents.

-- ---------------------------------------------------------------------------
-- Pastas
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_folders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.ledger_folders(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 120 and name !~ '[/\\]'),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create unique index if not exists ledger_folders_name_uidx
  on public.ledger_folders (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));
create index if not exists ledger_folders_parent_idx on public.ledger_folders(parent_id);

-- A folder can't end up inside itself when moved.
create or replace function public.ledger_guard_folder()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cursor uuid := new.parent_id;
  v_depth int := 0;
begin
  while v_cursor is not null loop
    if v_cursor = new.id then
      raise exception 'Uma pasta não pode ficar dentro de si própria.' using errcode = 'P0001';
    end if;
    v_depth := v_depth + 1;
    if v_depth > 20 then
      raise exception 'Demasiados níveis de pastas.' using errcode = 'P0001';
    end if;
    select parent_id into v_cursor from public.ledger_folders where id = v_cursor;
  end loop;
  new.name := btrim(new.name);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ledger_guard_folder on public.ledger_folders;
create trigger ledger_guard_folder
  before insert or update on public.ledger_folders
  for each row execute function public.ledger_guard_folder();

-- ---------------------------------------------------------------------------
-- Ficheiros: pasta e bucket
-- ---------------------------------------------------------------------------
alter table public.expense_documents
  add column if not exists folder_id uuid references public.ledger_folders(id) on delete restrict;
alter table public.expense_documents
  add column if not exists storage_bucket text not null default 'ledger-documents';
alter table public.expense_documents drop constraint if exists expense_documents_storage_bucket_check;
alter table public.expense_documents add constraint expense_documents_storage_bucket_check
  check (storage_bucket in ('ledger-documents', 'accounting-archive'));
create index if not exists expense_documents_folder_idx on public.expense_documents(folder_id) where folder_id is not null;

-- A file may now live only in a folder, waiting to be linked.
alter table public.expense_documents drop constraint if exists expense_documents_has_owner;

-- ---------------------------------------------------------------------------
-- Ligações ficheiro ↔ coisas
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_document_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.expense_documents(id) on delete cascade,
  target_type text not null check (target_type in (
    'bank_transaction', 'factpt_document', 'pilgrimage_payment', 'pilgrimage_cost', 'agreement'
  )),
  target_id text not null check (length(target_id) between 1 and 200),
  -- Filled for bank movements only: real foreign key + closed-month lock.
  bank_transaction_id uuid references public.bank_transactions(id) on delete cascade,
  label text,
  created_by text,
  created_at timestamptz not null default now(),
  check ((target_type = 'bank_transaction') = (bank_transaction_id is not null)),
  check (target_type <> 'bank_transaction' or target_id = bank_transaction_id::text)
);
create unique index if not exists ledger_document_links_uidx
  on public.ledger_document_links(document_id, target_type, target_id);
create index if not exists ledger_document_links_tx_idx
  on public.ledger_document_links(bank_transaction_id) where bank_transaction_id is not null;
create index if not exists ledger_document_links_target_idx
  on public.ledger_document_links(target_type, target_id);

drop trigger if exists ledger_guard_document_links on public.ledger_document_links;
create trigger ledger_guard_document_links
  before insert or update or delete on public.ledger_document_links
  for each row execute function public.ledger_guard_children();

-- History: events can now be about a file that has no movement yet.
alter table public.ledger_events add column if not exists document_id uuid;
alter table public.ledger_events drop constraint if exists ledger_events_has_subject;
alter table public.ledger_events add constraint ledger_events_has_subject
  check (bank_transaction_id is not null or agreement_id is not null or document_id is not null);

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
  insert into public.ledger_events (bank_transaction_id, agreement_id, document_id, action, actor, before, after)
  values (
    (v_row ->> 'bank_transaction_id')::uuid,
    case when tg_table_name = 'supplier_agreements' then (v_row ->> 'id')::uuid else (v_row ->> 'agreement_id')::uuid end,
    case tg_table_name
      when 'expense_documents' then (v_row ->> 'id')::uuid
      when 'ledger_document_links' then (v_row ->> 'document_id')::uuid
      else null
    end,
    tg_table_name || '.' || lower(tg_op),
    v_actor,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists ledger_log_document_links on public.ledger_document_links;
create trigger ledger_log_document_links
  after insert or delete on public.ledger_document_links
  for each row execute function public.ledger_log_child();

-- The old "main movement" column always has a matching link.
create or replace function public.ledger_sync_document_primary_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.bank_transaction_id is not null
     and (tg_op = 'INSERT' or new.bank_transaction_id is distinct from old.bank_transaction_id) then
    insert into public.ledger_document_links (document_id, target_type, target_id, bank_transaction_id, created_by)
    values (new.id, 'bank_transaction', new.bank_transaction_id::text, new.bank_transaction_id, new.uploaded_by)
    on conflict (document_id, target_type, target_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists ledger_sync_document_primary_link on public.expense_documents;
create trigger ledger_sync_document_primary_link
  after insert or update of bank_transaction_id on public.expense_documents
  for each row execute function public.ledger_sync_document_primary_link();

-- Unlinking the main movement moves "main" to another linked movement (or none).
create or replace function public.ledger_sync_document_primary_unlink()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.target_type = 'bank_transaction' then
    update public.expense_documents d
    set bank_transaction_id = (
      select l.bank_transaction_id from public.ledger_document_links l
      where l.document_id = old.document_id and l.target_type = 'bank_transaction' and l.id <> old.id
      order by l.created_at limit 1
    )
    where d.id = old.document_id and d.bank_transaction_id = old.bank_transaction_id;
  end if;
  return old;
end;
$$;

drop trigger if exists ledger_sync_document_primary_unlink on public.ledger_document_links;
create trigger ledger_sync_document_primary_unlink
  after delete on public.ledger_document_links
  for each row execute function public.ledger_sync_document_primary_unlink();

-- ---------------------------------------------------------------------------
-- Dados antigos
-- ---------------------------------------------------------------------------
-- 1. Every file already attached to a movement gets its link.
insert into public.ledger_document_links (document_id, target_type, target_id, bank_transaction_id, created_by, created_at)
select d.id, 'bank_transaction', d.bank_transaction_id::text, d.bank_transaction_id, coalesce(d.uploaded_by, 'backfill'), d.created_at
from public.expense_documents d
join public.bank_transactions t on t.id = d.bank_transaction_id
where d.bank_transaction_id is not null
on conflict (document_id, target_type, target_id) do nothing;

-- 2. The private archive imported on 2026-11-11 becomes real folders and files.
--    Storage keys are b_<base64url(name)>; nothing is copied, the rows point at the same objects.
with o as (
  select name, created_at, metadata,
         split_part(name, '/', 2) as folder_key,
         split_part(split_part(name, '/', 3), '.', 1) as file_key
  from storage.objects
  where bucket_id = 'accounting-archive' and split_part(name, '/', 1) = 'contabilidade-apostolado'
    and split_part(name, '/', 3) <> '' and split_part(name, '/', 4) = ''
    and split_part(name, '/', 2) like 'b\_%' and split_part(name, '/', 3) like 'b\_%'
)
select name, created_at, metadata,
  convert_from(decode(translate(substr(folder_key, 3), '-_', '+/')
    || repeat('=', (4 - length(substr(folder_key, 3)) % 4) % 4), 'base64'), 'UTF8') as folder_name,
  convert_from(decode(translate(substr(file_key, 3), '-_', '+/')
    || repeat('=', (4 - length(substr(file_key, 3)) % 4) % 4), 'base64'), 'UTF8') as file_name
into temporary table ledger_archive_import
from o;

insert into public.ledger_folders (name, created_by)
select 'contabilidade-apostolado', 'arquivo:importado'
where exists (select 1 from ledger_archive_import)
  and not exists (select 1 from public.ledger_folders where parent_id is null and lower(name) = 'contabilidade-apostolado');

insert into public.ledger_folders (parent_id, name, created_by)
select root.id, f.folder_name, 'arquivo:importado'
from (
  select distinct on (lower(btrim(translate(folder_name, '/\', '--')))) btrim(translate(folder_name, '/\', '--')) as folder_name
  from ledger_archive_import order by lower(btrim(translate(folder_name, '/\', '--'))), folder_name
) f
cross join lateral (
  select id from public.ledger_folders where parent_id is null and lower(name) = 'contabilidade-apostolado'
) root
where not exists (
  select 1 from public.ledger_folders x where x.parent_id = root.id and lower(x.name) = lower(f.folder_name)
);

insert into public.expense_documents (
  storage_bucket, storage_path, file_name, mime_type, size_bytes, folder_id, doc_kind, uploaded_by, created_at
)
select 'accounting-archive', a.name, a.file_name, a.metadata ->> 'mimetype',
       nullif((a.metadata ->> 'size')::bigint, 0)::integer, folder.id,
       case
         when a.folder_name ilike 'FT%' then 'fatura'
         when a.folder_name ilike 'RECIBO%' then 'recibo'
         else 'outro'
       end,
       'arquivo:importado', a.created_at
from ledger_archive_import a
join public.ledger_folders root on root.parent_id is null and lower(root.name) = 'contabilidade-apostolado'
join public.ledger_folders folder on folder.parent_id = root.id
  and lower(folder.name) = lower(btrim(translate(a.folder_name, '/\', '--')))
where not exists (select 1 from public.expense_documents d where d.storage_path = a.name);

drop table ledger_archive_import;

-- ---------------------------------------------------------------------------
-- Acesso: só o servidor (service_role)
-- ---------------------------------------------------------------------------
alter table public.ledger_folders enable row level security;
alter table public.ledger_document_links enable row level security;
revoke all on public.ledger_folders, public.ledger_document_links from anon, authenticated;
grant select, insert, update, delete on public.ledger_folders, public.ledger_document_links to service_role;

revoke all on function public.ledger_guard_folder() from public, anon, authenticated;
revoke all on function public.ledger_log_child() from public, anon, authenticated;
revoke all on function public.ledger_sync_document_primary_link() from public, anon, authenticated;
revoke all on function public.ledger_sync_document_primary_unlink() from public, anon, authenticated;
