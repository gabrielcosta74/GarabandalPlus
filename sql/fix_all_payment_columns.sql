-- Unified Migration: Fix all missing columns in pilgrimage_payments
-- Run this in the Supabase SQL Editor to solve the 'PGRST204' error.

ALTER TABLE pilgrimage_payments 
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

ALTER TABLE pilgrimage_payments 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Also add deposit_confirmed_at to bookings if missing (useful for the roadmap)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS deposit_confirmed_at TIMESTAMP WITH TIME ZONE;
