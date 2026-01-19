-- Migration: Add 'notes' column to pilgrimage_payments
-- This column is used to store payment details like "Stripe Automatic" or "User Receipt Uploaded"

ALTER TABLE pilgrimage_payments 
ADD COLUMN IF NOT EXISTS notes TEXT;
