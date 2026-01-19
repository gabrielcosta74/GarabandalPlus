-- Migration: Add WhatsApp Notifications Logic

CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- 'booking_confirmation', 'payment_verified', etc.
  reference TEXT NOT NULL, -- booking_id, payment_id
  phone TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'queued'
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups (Idempotency)
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_type_ref ON whatsapp_notifications(type, reference);

-- Grant permissions if needed (usually handled by service role, but good practice)
ALTER TABLE whatsapp_notifications ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated admins (policy example)
CREATE POLICY "Admins can view whatsapp logs" ON whatsapp_notifications
    FOR SELECT TO authenticated
    USING (auth.jwt() ->> 'email' IN (SELECT email FROM admins)); 
    -- Note: 'admins' table or logic might vary, sticking to basic RLS enabled for now.
