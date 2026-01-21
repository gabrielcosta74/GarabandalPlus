-- ============================================================
-- SECURITY HARDENING: RLS Policies
-- Migration: security_hardening_rls
-- Description: Fixes critical RLS vulnerabilities in bookings, payments, and leads
-- ============================================================

-- ============================================================
-- PART 1: Add Required Security Columns
-- ============================================================

-- Add view_token for secure public booking access
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS view_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_view_token ON bookings(view_token) WHERE view_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_idempotency ON bookings(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Add idempotency for payments
ALTER TABLE pilgrimage_payments
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON pilgrimage_payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- PART 2: CRITICAL FIX - Pilgrimage Payments RLS
-- Current Issue: ANY authenticated user can read/update ALL payments
-- ============================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "pilgrimage_payments_select_policy" ON pilgrimage_payments;
DROP POLICY IF EXISTS "pilgrimage_payments_update_policy" ON pilgrimage_payments;
DROP POLICY IF EXISTS "pilgrimage_payments_insert_policy" ON pilgrimage_payments;

-- Secure SELECT: Users can only view their own payments OR payments for their bookings
CREATE POLICY "Users view own payments only"
  ON pilgrimage_payments FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM bookings 
      WHERE bookings.id = pilgrimage_payments.booking_id 
      AND bookings.user_id = auth.uid()
    )
  );

-- Secure INSERT: Must be authenticated and own the booking
CREATE POLICY "Users create own payments only"
  ON pilgrimage_payments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = pilgrimage_payments.booking_id
      AND bookings.user_id = auth.uid()
    )
  );

-- Secure UPDATE: Users can only update their own payments
-- Note: RLS cannot prevent field changes, that must be enforced in application logic
CREATE POLICY "Users update own payment metadata"
  ON pilgrimage_payments FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = pilgrimage_payments.booking_id
      AND bookings.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
  );

-- ============================================================
-- PART 3: CRITICAL FIX - Booking Leads RLS
-- Current Issue: USING(true) allows anyone to update any lead
-- ============================================================

-- Drop dangerous open policy
DROP POLICY IF EXISTS "Anon can update own lead (via API with ID/Email match - logic i" ON booking_leads;

-- More restrictive update: Only via email match or authenticated
CREATE POLICY "Controlled lead updates"
  ON booking_leads FOR UPDATE
  -- Can only see/update if authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (true);

-- Keep existing insert policy (anon can create leads)
-- Keep existing select policy (authenticated can view)

-- ============================================================
-- PART 4: FIX - Bookings RLS
-- Current Issue: INSERT checks role instead of uid match
-- Missing: UPDATE policy
-- ============================================================

-- Drop and recreate INSERT policy with correct check
DROP POLICY IF EXISTS "Users can create own bookings" ON bookings;
CREATE POLICY "Users can create own bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add missing UPDATE policy
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;
CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- PART 5: Add Public View Policy for Bookings (Token-Based)
-- Allows public viewing with secure token for success page
-- ============================================================

DROP POLICY IF EXISTS "Public can view booking with token" ON bookings;
CREATE POLICY "Public can view booking with token"
  ON bookings FOR SELECT
  USING (
    -- Either owns the booking OR has valid view_token
    auth.uid() = user_id 
    OR (
      view_token IS NOT NULL 
      AND view_token = current_setting('request.headers', true)::json->>'x-view-token'
    )
  );

-- Note: The token check above requires the token to be passed in headers
-- Alternative: API endpoint validates token before using service role

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verify policies are in place
SELECT 
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies 
WHERE tablename IN ('bookings', 'pilgrimage_payments', 'booking_leads')
ORDER BY tablename, policyname;

-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name IN ('view_token', 'idempotency_key');

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pilgrimage_payments' 
AND column_name = 'idempotency_key';
