ALTER TABLE pilgrimage_payments 
ADD COLUMN IF NOT EXISTS external_reference TEXT,
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pilgrimage_payments_payment_intent 
ON pilgrimage_payments(payment_intent_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pilgrimage_payments_external_ref
ON pilgrimage_payments(external_reference);
