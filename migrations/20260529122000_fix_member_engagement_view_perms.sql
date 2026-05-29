-- Fix: admin_member_engagement was created with security_invoker = true, which
-- made the auth.users join fail (42501 "permission denied for table users")
-- when queried by service_role through PostgREST.
--
-- Switch the view to run with its owner's privileges (security definer behaviour)
-- so the auth.users join is allowed, then lock SELECT down to service_role only
-- (the view bypasses underlying RLS, so it must never be exposed to anon/auth).

alter view public.admin_member_engagement set (security_invoker = false);

revoke all on public.admin_member_engagement from public, anon, authenticated;
grant select on public.admin_member_engagement to service_role;
