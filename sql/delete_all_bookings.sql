-- DANGER: This will delete ALL bookings, pilgrims data, and payments.
-- Use this ONLY if you want to clear all test data.

BEGIN;

-- 1. Delete all payments related to bookings
DELETE FROM pilgrimage_payments;

-- 2. Delete all pilgrims related to bookings
DELETE FROM pilgrims;

-- 3. Delete all bookings
DELETE FROM bookings;

COMMIT;

-- Optional: To reset ID counters (sequences) if you want IDs to start from 1 again
-- ALTER SEQUENCE bookings_id_seq RESTART WITH 1;
-- ALTER SEQUENCE pilgrims_id_seq RESTART WITH 1;
-- ALTER SEQUENCE pilgrimage_payments_id_seq RESTART WITH 1;
