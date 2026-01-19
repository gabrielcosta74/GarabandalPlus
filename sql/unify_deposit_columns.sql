-- Unify Deposit Columns: Phase 1
-- Copy values from min_deposit to deposit_value and make deposit_value the standard.

-- 1. Sync values where min_deposit is more up-to-date (not null and not 500 default if deposit_value is 100)
UPDATE pilgrimages 
SET deposit_value = min_deposit 
WHERE min_deposit IS NOT NULL AND (deposit_value = 100 OR deposit_value IS NULL);

-- 2. Ensure all rows have a value
UPDATE pilgrimages 
SET deposit_value = 500 
WHERE deposit_value IS NULL OR deposit_value = 0;

-- 3. (Optional but recommended) Update default of deposit_value to 500
ALTER TABLE pilgrimages ALTER COLUMN deposit_value SET DEFAULT 500.00;
