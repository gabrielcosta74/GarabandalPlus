-- Add 'stripe' to the allowed payment methods check constraint
-- Since modifying a check constraint usually requires dropping and recreating it, 
-- we will drop the existing constraint and add the new one.

DO $$ 
BEGIN
    -- Drop the old constraint if it exists
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pilgrimage_payments_method_check') THEN
        ALTER TABLE pilgrimage_payments DROP CONSTRAINT pilgrimage_payments_method_check;
    END IF;

    -- Add the new constraint including 'stripe'
    ALTER TABLE pilgrimage_payments 
    ADD CONSTRAINT pilgrimage_payments_method_check 
    CHECK (method IN ('wise', 'bank_transfer', 'mbway', 'manual', 'stripe'));
END $$;
