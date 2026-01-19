-- Migration: Add missing columns to pilgrims table
-- Description: Adds allergies, flight_option, notes, and cpf_nif columns to the pilgrims table

DO $$ 
BEGIN 
    -- Add allergies column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pilgrims' AND column_name='allergies') THEN
        ALTER TABLE pilgrims ADD COLUMN allergies TEXT;
    END IF;

    -- Add flight_option column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pilgrims' AND column_name='flight_option') THEN
        ALTER TABLE pilgrims ADD COLUMN flight_option TEXT DEFAULT 'none';
    END IF;

    -- Add notes column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pilgrims' AND column_name='notes') THEN
        ALTER TABLE pilgrims ADD COLUMN notes TEXT;
    END IF;

    -- Add cpf_nif column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pilgrims' AND column_name='cpf_nif') THEN
        ALTER TABLE pilgrims ADD COLUMN cpf_nif TEXT;
    END IF;

    -- Add address columns if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pilgrims' AND column_name='address') THEN
        ALTER TABLE pilgrims ADD COLUMN address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pilgrims' AND column_name='postal_code') THEN
        ALTER TABLE pilgrims ADD COLUMN postal_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pilgrims' AND column_name='city') THEN
        ALTER TABLE pilgrims ADD COLUMN city TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pilgrims' AND column_name='country') THEN
        ALTER TABLE pilgrims ADD COLUMN country TEXT;
    END IF;

    -- Add terms_accepted to bookings table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='terms_accepted') THEN
        ALTER TABLE bookings ADD COLUMN terms_accepted BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add payment_plan (JSONB) to bookings to store the chosen installment count and values
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_plan') THEN
        ALTER TABLE bookings ADD COLUMN payment_plan JSONB;
    END IF;
END $$;
