-- EMERGENCY: Disable RLS on bookings to diagnose/fix blocking issue
-- Only use this if the policy migrations failed to fix the issue.

ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE pilgrims DISABLE ROW LEVEL SECURITY;
