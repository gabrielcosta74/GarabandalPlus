alter table public.factpt_settings
  add column if not exists historical_manual_cutoff_at timestamptz;

comment on column public.factpt_settings.historical_manual_cutoff_at is
  'Confirmed payments before this instant were issued manually in FACT.pt '
  'and are intentionally not backfilled into factpt_documents.';

update public.factpt_settings
set historical_manual_cutoff_at = timestamptz '2026-07-29 11:26:15.272345+00'
where environment = 'production';
