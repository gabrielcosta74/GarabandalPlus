alter table public.donations
  add column if not exists donor_name text null,
  add column if not exists donor_email text null,
  add column if not exists donor_nif text null,
  add column if not exists donor_address text null,
  add column if not exists donor_city text null,
  add column if not exists donor_zip text null,
  add column if not exists donor_country text null;
