alter table public.store_products
  add column if not exists description text null,
  add column if not exists tags text[] null;
