-- Add RLS policy for Admin Access
-- This policy allows the specific admin email to VIEW ALL intentions
CREATE POLICY "Admin View All" ON prayer_intentions
    FOR SELECT
    USING (auth.jwt() ->> 'email' = 'geral@apostoladodegarabandal.com');

-- Also allow Admin to UPDATE (e.g. mark as presented)
CREATE POLICY "Admin Update All" ON prayer_intentions
    FOR UPDATE
    USING (auth.jwt() ->> 'email' = 'geral@apostoladodegarabandal.com');
