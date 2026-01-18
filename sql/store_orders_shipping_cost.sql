alter table public.store_orders
  add column if not exists shipping_cost numeric null,
  add column if not exists shipping_origin text null,
  add column if not exists shipping_zone text null;
