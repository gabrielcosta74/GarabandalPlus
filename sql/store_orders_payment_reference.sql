alter table public.store_orders
  add column if not exists payment_reference text null;
