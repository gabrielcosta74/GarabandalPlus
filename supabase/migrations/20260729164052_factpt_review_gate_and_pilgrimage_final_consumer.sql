-- Require an explicit admin review before selected FACT.pt jobs can be
-- claimed. Production remains disabled by the existing safety constraint.
alter table public.factpt_settings
  add column if not exists require_approval boolean not null default true;

comment on column public.factpt_settings.require_approval is
  'When true, new FACT.pt jobs wait for an explicit admin approval before the worker can claim them.';

-- Cache clients with NIF by NIF and named final consumers by a deterministic
-- server-side identity fingerprint. FACT.pt assigns its generic final-consumer
-- TIN remotely; it must never be used as the local identity key.
alter table public.factpt_clients
  add column if not exists lookup_key text;

update public.factpt_clients
set lookup_key = 'tin:' || tin
where lookup_key is null;

alter table public.factpt_clients
  alter column lookup_key set not null,
  alter column tin drop not null,
  drop constraint if exists factpt_clients_tin_check,
  drop constraint if exists factpt_clients_environment_credential_tin_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.factpt_clients'::regclass
      and conname = 'factpt_clients_tin_optional_check'
  ) then
    alter table public.factpt_clients
      add constraint factpt_clients_tin_optional_check
      check (tin is null or (tin = btrim(tin) and tin <> ''));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.factpt_clients'::regclass
      and conname = 'factpt_clients_environment_credential_lookup_key'
  ) then
    alter table public.factpt_clients
      add constraint factpt_clients_environment_credential_lookup_key
      unique (environment, credential_alias, lookup_key);
  end if;
end
$$;

comment on column public.factpt_clients.lookup_key is
  'TIN key or SHA-256 final-consumer identity key; contains no raw address data.';

alter table public.factpt_documents
  add column if not exists review_prepared_at timestamp with time zone,
  add column if not exists approved_at timestamp with time zone,
  add column if not exists approved_by uuid,
  add column if not exists approved_snapshot_hash text;

alter table public.factpt_documents
  drop constraint if exists factpt_documents_status_check;

alter table public.factpt_documents
  add constraint factpt_documents_status_check
  check (
    status in (
      'awaiting_approval',
      'pending',
      'needs_data',
      'processing',
      'issued',
      'failed',
      'email_failed'
    )
  );

alter table public.factpt_documents
  drop constraint if exists factpt_documents_client_action_check;

alter table public.factpt_documents
  add constraint factpt_documents_client_action_check
  check (
    client_action is null
    or client_action in (
      'reused',
      'created',
      'updated',
      'final_consumer'
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.factpt_documents'::regclass
      and conname = 'factpt_documents_approval_pair_check'
  ) then
    alter table public.factpt_documents
      add constraint factpt_documents_approval_pair_check
      check (
        (approved_at is null and approved_by is null and approved_snapshot_hash is null)
        or
        (
          approved_at is not null
          and approved_by is not null
          and approved_snapshot_hash ~ '^[0-9a-f]{64}$'
        )
      );
  end if;
end
$$;

comment on column public.factpt_documents.review_prepared_at is
  'Timestamp when the immutable fiscal preview was validated against FACT.pt taxes and products.';
comment on column public.factpt_documents.approved_at is
  'Timestamp of the explicit admin approval that released this job to the worker.';
comment on column public.factpt_documents.approved_by is
  'Supabase auth user ID of the administrator who approved the fiscal preview.';
comment on column public.factpt_documents.approved_snapshot_hash is
  'SHA-256 of the canonical fiscal snapshot approved by the administrator.';

create index if not exists factpt_documents_review_idx
  on public.factpt_documents (environment, payment_confirmed_at, created_at)
  where status = 'awaiting_approval';

create or replace function factpt_private.enforce_review_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending'
     and new.approved_at is null
     and exists (
       select 1
       from public.factpt_settings as settings
       where settings.environment = new.environment
         and settings.require_approval
     ) then
    new.status := 'awaiting_approval';
  end if;
  return new;
end;
$$;

drop trigger if exists factpt_documents_enforce_review_gate
  on public.factpt_documents;

create trigger factpt_documents_enforce_review_gate
before insert on public.factpt_documents
for each row execute function factpt_private.enforce_review_gate();

revoke all on function factpt_private.enforce_review_gate()
  from public, anon, authenticated;
