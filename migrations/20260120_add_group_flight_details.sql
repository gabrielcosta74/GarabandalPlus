-- Add group_flight_details column to pilgrimages table
ALTER TABLE pilgrimages
ADD COLUMN group_flight_details TEXT;

-- Comment for clarity
COMMENT ON COLUMN pilgrimages.group_flight_details IS 'Detailed information about group flight (schedule, airline, airport) for Option B.';
