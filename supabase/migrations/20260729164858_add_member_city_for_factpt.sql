alter table public.membros
  add column if not exists city text;

comment on column public.membros.city is
  'Account-holder billing and contact city; required before issuing a pilgrimage Fatura-Recibo.';
