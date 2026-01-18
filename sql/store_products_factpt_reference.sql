alter table public.store_products
  add column if not exists factpt_reference text null;
