create table if not exists public.store_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  report_month integer not null,
  report_year integer not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  file_path text not null,
  total_orders integer null,
  total_revenue numeric null,
  currency text not null default 'EUR',
  created_by text null,
  created_at timestamptz not null default now(),
  unique (kind, report_month, report_year)
);
