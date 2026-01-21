-- Add location column to pilgrimages table
ALTER TABLE pilgrimages
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'Garabandal, Espanha';

COMMENT ON COLUMN pilgrimages.location IS 'Location of the pilgrimage (e.g., Garabandal, Espanha, Fátima, Portugal)';
