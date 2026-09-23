-- Existing project defaults can grant DELETE to service_role on new public
-- tables. The mobile handoff only inserts, reads, and atomically consumes rows.
revoke all on public.mobile_booking_web_handoffs from service_role;
grant select, insert, update on public.mobile_booking_web_handoffs to service_role;
