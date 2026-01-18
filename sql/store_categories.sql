create table if not exists public.store_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text null,
  created_at timestamptz not null default now()
);
