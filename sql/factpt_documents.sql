create table if not exists public.factpt_documents (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_ref text not null,
  status text not null default 'pending',
  factpt_document_id text null,
  factpt_url text null,
  payload jsonb null,
  response jsonb null,
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists factpt_documents_source_idx
  on public.factpt_documents(source_type, source_ref);
