create table if not exists public.store_stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  delta integer not null,
  reason text null,
  admin_email text null,
  created_at timestamptz not null default now()
);
