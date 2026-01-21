-- Add itinerary_summary column to pilgrimages table
ALTER TABLE pilgrimages
ADD COLUMN IF NOT EXISTS itinerary_summary TEXT;

COMMENT ON COLUMN pilgrimages.itinerary_summary IS 'Summary of the itinerary locations (e.g., Lisboa - Fátima - Garabandal)';
