-- Migration: Add Deposit Value to Pilgrimages
-- Description: Adds a column to specify the mandatory registration fee (sinal).

alter table pilgrimages 
add column if not exists deposit_value decimal(10,2) not null default 100.00;

-- Update existing rows to have 100.00 just in case
update pilgrimages set deposit_value = 100.00 where deposit_value is null;
