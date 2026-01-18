alter table public.store_orders
  add column if not exists buyer_user_id uuid null,
  add column if not exists buyer_nif text null,
  add column if not exists claimed_at timestamptz null,
  add column if not exists claim_source text null;

create table if not exists public.store_order_access_tokens (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null,
  buyer_email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists store_order_access_tokens_order_ref_idx
  on public.store_order_access_tokens(order_ref);

create index if not exists store_order_access_tokens_email_idx
  on public.store_order_access_tokens(buyer_email);

create table if not exists public.store_digital_access_tokens (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null,
  product_id text not null,
  buyer_email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  last_access_at timestamptz null,
  download_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists store_digital_access_tokens_order_ref_idx
  on public.store_digital_access_tokens(order_ref);

create index if not exists store_digital_access_tokens_product_idx
  on public.store_digital_access_tokens(product_id);
