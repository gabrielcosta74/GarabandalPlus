alter table public.testimonials
  add column if not exists role_en text null,
  add column if not exists text_en text null;
