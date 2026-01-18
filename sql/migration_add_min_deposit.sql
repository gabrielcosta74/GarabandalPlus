-- Add min_deposit column to pilgrimages table
alter table public.pilgrimages 
add column if not exists min_deposit numeric default 500;

comment on column public.pilgrimages.min_deposit is 'Valor do sinal de reserva (depósito mínimo) para participar na peregrinação';
