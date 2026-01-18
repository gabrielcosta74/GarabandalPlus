-- Migration: Fix RLS for Bookings and Pilgrims
-- Description: Ensures authenticated users can insert their own bookings and pilgrims.

-- 1. BOOKINGS

-- Drop potentially conflicting or restrictive policies
DROP POLICY IF EXISTS "Users can create own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;

-- Re-create robust policies
CREATE POLICY "Users can create own bookings"
  ON bookings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own bookings"
  ON bookings
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. PILGRIMS

-- Drop potentially conflicting or restrictive policies
DROP POLICY IF EXISTS "Users can manage own pilgrims" ON pilgrims;

-- Note: Depending on logic, users might insert pilgrims BEFORE the booking is committed? 
-- No, the code inserts booking first, then pilgrims with booking_id.
-- So the policy must check that the booking belongs to the user.

CREATE POLICY "Users can manage own pilgrims"
  ON pilgrims
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = pilgrims.booking_id
      AND bookings.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = pilgrims.booking_id
      AND bookings.user_id = auth.uid()
    )
  );

-- 3. ENSURE RLS IS ON
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pilgrims ENABLE ROW LEVEL SECURITY;
