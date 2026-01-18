create table if not exists public.store_digital_access (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null,
  product_id text not null,
  buyer_email text not null,
  user_id uuid null,
  status text not null default 'available',
  qty int not null default 1,
  file_url text null,
  created_at timestamptz not null default now(),
  last_access_at timestamptz null,
  download_count int not null default 0
);

create index if not exists store_digital_access_user_id_idx on public.store_digital_access (user_id);
create index if not exists store_digital_access_buyer_email_idx on public.store_digital_access (buyer_email);
create unique index if not exists store_digital_access_order_product_idx on public.store_digital_access (order_ref, product_id);
