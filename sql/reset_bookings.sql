-- DANGER: This will delete ALL bookings, pilgrims, and payments!
-- Use this for resetting the testing environment.

DELETE FROM bookings;

-- Note: pilgrims and pilgrimages_payments will be deleted automatically 
-- due to 'ON DELETE CASCADE' constraints defined in migration_pilgrimages_core.sql
