create table if not exists public.factpt_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  name text null,
  email text null,
  nif text null,
  country text null,
  factpt_client_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists factpt_clients_user_id_idx
  on public.factpt_clients(user_id);

create unique index if not exists factpt_clients_email_idx
  on public.factpt_clients(lower(email))
  where email is not null;

create unique index if not exists factpt_clients_nif_idx
  on public.factpt_clients(nif)
  where nif is not null;
