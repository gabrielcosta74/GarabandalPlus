-- Allow Admin to read all profiles in 'membros' to display names in dashboards
-- This fixes the "Desconhecido" issue in the Admin Intentions panel

CREATE POLICY "Admin View All Membros" ON membros
    FOR SELECT
    USING (auth.jwt() ->> 'email' = 'geral@apostoladodegarabandal.com');
