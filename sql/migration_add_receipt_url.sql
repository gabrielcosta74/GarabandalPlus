-- Migration: Add receipt_url to pilgrimage_payments
-- This allows storing the link to the uploaded transfer proof.

ALTER TABLE pilgrimage_payments 
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Optional: Add a column to bookings to track if the deposit specifically was confirmed by admin
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS deposit_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Ensure storage bucket 'receipts' is expected to exist. 
-- Note: Bucket creation usually via Supabase Dashboard or API, but we'll assume it's created or provide instructions.
