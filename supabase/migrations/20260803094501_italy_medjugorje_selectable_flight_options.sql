-- Restore a direct flight choice for new Italy + Medjugorje registrations.
-- This changes only the pilgrimage configuration. Existing bookings and
-- pilgrims, including their stored flight_option values, are intentionally
-- left untouched.
-- Flight copy is managed separately in the admin and must also be preserved.
update public.pilgrimages
set
  pricing_config = (
    coalesce(pricing_config, '{}'::jsonb) - 'flight_registration_policy'
  ) || jsonb_build_object(
    'flight_registration_options',
    jsonb_build_array('own', 'agency')
  )
where id = 'a7e2616e-fe39-48dc-968e-b14153c25325'::uuid
  and slug = 'italia-medjugorje-abril-2027';
