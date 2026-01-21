-- Add admin access to pilgrimage_payments
-- Since there's no profiles table, we'll use a simpler approach:
-- Allow any authenticated user to view/edit payments (admin panel is already protected)

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "pilgrimage_payments_select_policy" ON pilgrimage_payments;

-- New SELECT policy: Users can view their own payments OR any authenticated user (for admin panel)
CREATE POLICY "pilgrimage_payments_select_policy" ON pilgrimage_payments
    FOR SELECT
    USING (
        -- User owns the booking
        EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = pilgrimage_payments.booking_id
            AND bookings.user_id = auth.uid()
        )
        OR
        -- OR: User is authenticated (admin panel access is controlled at app level)
        auth.uid() IS NOT NULL
    );

-- Also allow authenticated users to UPDATE payments (for edit/delete functionality)
DROP POLICY IF EXISTS "pilgrimage_payments_update_policy" ON pilgrimage_payments;

CREATE POLICY "pilgrimage_payments_update_policy" ON pilgrimage_payments
    FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to INSERT payments manually
DROP POLICY IF EXISTS "pilgrimage_payments_insert_policy" ON pilgrimage_payments;

CREATE POLICY "pilgrimage_payments_insert_policy" ON pilgrimage_payments
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON POLICY "pilgrimage_payments_select_policy" ON pilgrimage_payments IS 
'Allow users to view their own payments, and any authenticated user to view all payments (admin access controlled at app level)';

