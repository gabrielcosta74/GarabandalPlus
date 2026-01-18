alter table public.store_orders
  add column if not exists shipping_tracking text null,
  add column if not exists shipped_at timestamptz null;
