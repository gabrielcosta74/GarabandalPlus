-- Fix RLS Policy for booking_leads
-- The previous policy required a specific email. This one allows any logged-in user (controlled by Admin Shell in app)

drop policy if exists "Admins can view all leads" on booking_leads;

create policy "Authenticated users can view leads"
  on booking_leads for select
  using (auth.role() = 'authenticated');
