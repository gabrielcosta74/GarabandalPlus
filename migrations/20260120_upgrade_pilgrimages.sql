-- Add new fields to pilgrimages table for enhanced details
ALTER TABLE pilgrimages
ADD COLUMN IF NOT EXISTS meeting_point_text TEXT,
ADD COLUMN IF NOT EXISTS meeting_end_text TEXT,
ADD COLUMN IF NOT EXISTS flight_info_text TEXT,
ADD COLUMN IF NOT EXISTS payment_plan_text TEXT,
ADD COLUMN IF NOT EXISTS cancellation_policy_text TEXT,
ADD COLUMN IF NOT EXISTS not_included_items TEXT[];

-- Add comments for documentation
COMMENT ON COLUMN pilgrimages.meeting_point_text IS 'Details about meeting point location and time (Start)';
COMMENT ON COLUMN pilgrimages.meeting_end_text IS 'Details about endpoint location and time (End)';
COMMENT ON COLUMN pilgrimages.flight_info_text IS 'Information and suggestions regarding flights';
COMMENT ON COLUMN pilgrimages.payment_plan_text IS 'Description of payment installment plans';
COMMENT ON COLUMN pilgrimages.cancellation_policy_text IS 'Full cancellation policy text (HTML/Markdown)';
COMMENT ON COLUMN pilgrimages.not_included_items IS 'List of items specifically NOT included in the price';
