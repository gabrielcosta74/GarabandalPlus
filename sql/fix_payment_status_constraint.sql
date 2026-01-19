-- Migration: Fix pilgrimage_payments_status_check constraint
-- This migration updates the allowed statuses to include those used by Stripe and manual uploads.

-- 1. Drop the old constraint
ALTER TABLE pilgrimage_payments 
DROP CONSTRAINT IF EXISTS pilgrimage_payments_status_check;

-- 2. Add the updated constraint with all necessary statuses
ALTER TABLE pilgrimage_payments 
ADD CONSTRAINT pilgrimage_payments_status_check 
CHECK (status IN ('pending', 'pending_verification', 'verifying', 'succeeded', 'verified', 'failed'));

-- 3. Also update any existing rows that might be in an inconsistent state (optional)
UPDATE pilgrimage_payments SET status = 'pending_verification' WHERE status = 'pending';
