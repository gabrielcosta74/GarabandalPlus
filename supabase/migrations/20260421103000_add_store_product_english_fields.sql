alter table if exists public.store_products
  add column if not exists name_en text null,
  add column if not exists description_en text null;

alter table if exists public.categories
  add column if not exists name_en text null,
  add column if not exists description_en text null;

alter table if exists public.store_categories
  add column if not exists name_en text null,
  add column if not exists description_en text null;
