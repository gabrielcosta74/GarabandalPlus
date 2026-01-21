-- Add soft delete and edit tracking columns to pilgrimage_payments
ALTER TABLE pilgrimage_payments 
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb;

-- Create index for performance (only query non-deleted payments)
CREATE INDEX IF NOT EXISTS idx_payments_not_deleted 
ON pilgrimage_payments(booking_id) 
WHERE deleted = FALSE;

-- Add comment for documentation
COMMENT ON COLUMN pilgrimage_payments.deleted IS 'Soft delete flag - payment is hidden but kept for audit trail';
COMMENT ON COLUMN pilgrimage_payments.edit_history IS 'JSON array tracking all edits: [{edited_at, old_amount, new_amount, edited_by}]';
