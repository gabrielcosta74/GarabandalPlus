-- SQL Fix: Set default prices for pilgrimages with missing or zero values
-- This ensures that the booking calculation doesn't fail with "total = 0"

UPDATE pilgrimages 
SET 
  base_price = CASE 
    WHEN base_price IS NULL OR base_price = 0 THEN 1200 
    ELSE base_price 
  END,
  deposit_value = CASE 
    WHEN deposit_value IS NULL OR deposit_value = 0 THEN 500 
    ELSE deposit_value 
  END
WHERE 
  base_price IS NULL OR 
  base_price = 0 OR 
  deposit_value IS NULL OR 
  deposit_value = 0;

-- Also ensure pricing_config has a default structure
UPDATE pilgrimages
SET pricing_config = '{"room_supplements": {"single": 250, "double": 0, "triple": 0, "quadruple": 0}}'::jsonb
WHERE pricing_config IS NULL OR pricing_config = '{}'::jsonb;
