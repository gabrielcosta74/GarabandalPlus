-- Add registration_deadline and flight_price_from to pilgrimages table

ALTER TABLE pilgrimages
ADD COLUMN registration_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN flight_price_from NUMERIC;

COMMENT ON COLUMN pilgrimages.registration_deadline IS 'Date when registrations close';
COMMENT ON COLUMN pilgrimages.flight_price_from IS 'Starting price for the flight option (Option B)';
