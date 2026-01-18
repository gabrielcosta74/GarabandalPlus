alter table public.store_products
  add column if not exists sku text null,
  add column if not exists category text null,
  add column if not exists price numeric not null default 0,
  add column if not exists currency text not null default 'EUR',
  add column if not exists is_active boolean not null default true,
  add column if not exists is_physical boolean not null default true,
  add column if not exists image_url text null,
  add column if not exists digital_url text null,
  add column if not exists low_stock_threshold integer not null default 3;
