-- Migration V2: Schema Upgrade for Detailed Booking Flow

-- 1. Pilgrimages: Add Pricing Configuration
-- This JSONB will store strict pricing rules like: {"single": 1200, "double": 1000, "family": 900}
ALTER TABLE pilgrimages
ADD COLUMN IF NOT EXISTS pricing_config JSONB DEFAULT '{}'::jsonb;

-- 2. Pilgrims: Add Detailed Logistics & Personal Info
ALTER TABLE pilgrims
ADD COLUMN IF NOT EXISTS flight_option text, -- 'agency', 'group', 'own', 'none'
ADD COLUMN IF NOT EXISTS allergies text, -- 'Nenhuma' or specific details
ADD COLUMN IF NOT EXISTS notes text, -- General observations
ADD COLUMN IF NOT EXISTS cpf_nif text, -- Tax ID
ADD COLUMN IF NOT EXISTS whatsapp text; -- Contact Number specific for WA

-- 3. Bookings: Legal
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false;

-- Force schema reload
NOTIFY pgrst, 'reload config';
