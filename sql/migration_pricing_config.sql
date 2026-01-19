-- Migration: Add dynamic pricing configuration to pilgrimages
-- Description: Adds pricing_config JSONB column to store room supplements

-- Add pricing_config column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pilgrimages' AND column_name='pricing_config') THEN
        ALTER TABLE pilgrimages ADD COLUMN pricing_config JSONB DEFAULT '{"room_supplements": {"single": 0, "double": 0, "triple": 0, "quadruple": 0}}'::jsonb;
    END IF;
END $$;

-- Update existing records with default structure if needed
UPDATE pilgrimages 
SET pricing_config = '{"room_supplements": {"single": 250, "double": 0, "triple": 0, "quadruple": 0}}'::jsonb
WHERE pricing_config IS NULL;

-- Ensure other necessary columns for the "Smart Installments" and Pricing are present
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pilgrimages' AND column_name='deposit_value') THEN
        ALTER TABLE pilgrimages ADD COLUMN deposit_value NUMERIC DEFAULT 500;
    END IF;
END $$;
