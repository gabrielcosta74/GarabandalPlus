-- 20260303_fix_effective_vacancies.sql
-- Updates the calculation of vacancies so that all submitted bookings 
-- (both confirmed and pending payment) deduct from available spots.

-- 1. Update the view: v_pilgrimage_occupancy
CREATE OR REPLACE VIEW public.v_pilgrimage_occupancy AS
WITH booking_counts AS (
  SELECT
    b.id as booking_id,
    COUNT(pl.id)::integer as pax_count
  FROM public.bookings b
  JOIN public.pilgrims pl ON pl.booking_id = b.id
  WHERE lower(coalesce(b.status, '')) NOT IN ('canceled', 'cancelled')
  GROUP BY b.id
),
booking_status AS (
  SELECT
    b.pilgrimage_id,
    b.id as booking_id,
    bc.pax_count,
    b.paid_amount,
    p.deposit_value,
    (b.paid_amount >= (p.deposit_value * bc.pax_count::numeric)) as is_confirmed
  FROM public.bookings b
  JOIN booking_counts bc ON bc.booking_id = b.id
  JOIN public.pilgrimages p ON p.id = b.pilgrimage_id
  WHERE lower(coalesce(b.status, '')) NOT IN ('canceled', 'cancelled')
)
SELECT
  p.id as pilgrimage_id,
  p.total_vacancies,
  coalesce(sum(case when bs.is_confirmed then bs.pax_count else 0 end), 0)::integer as confirmed_pax,
  coalesce(sum(case when not bs.is_confirmed then bs.pax_count else 0 end), 0)::integer as pending_pax,
  -- EFFECTIVE VACANCIES UPDATE: Subtrai também os pendentes!
  -- No current_vacancies o cálculo "web_occupied_pax" já abate tudo (confirmadas e pendentes) ao correr a store procedure,
  -- logo devolvemos logo o current_vacancies, sem recuar para total_vacancies
  greatest(0, coalesce(p.current_vacancies, p.total_vacancies, 0))::integer as effective_vacancies
FROM public.pilgrimages p
LEFT JOIN booking_status bs ON bs.pilgrimage_id = p.id
GROUP BY p.id, p.total_vacancies, p.current_vacancies;


-- 2. Update the function: get_pilgrimage_list
CREATE OR REPLACE FUNCTION public.get_pilgrimage_list(p_slug text default null)
RETURNS table(
  id uuid,
  title text,
  slug text,
  description text,
  cover_image text,
  start_date timestamptz,
  end_date timestamptz,
  total_vacancies integer,
  current_vacancies integer,
  base_price numeric,
  status text,
  deposit_value numeric,
  confirmed_pax integer,
  pending_pax integer,
  effective_vacancies integer,
  itinerary_summary text,
  min_deposit numeric,
  pricing_config jsonb,
  meeting_point_text text,
  meeting_end_text text,
  flight_info_text text,
  payment_plan_text text,
  cancellation_policy_text text,
  registration_deadline timestamptz,
  flight_price_from numeric,
  group_flight_details text,
  included_items jsonb,
  not_included_items jsonb
)
LANGUAGE plpgsql
SECURITY definer
AS $$
BEGIN
  RETURN QUERY
  WITH booking_counts AS (
    SELECT
      b.pilgrimage_id,
      COUNT(pl.id) as pax_count,
      b.id as booking_id,
      b.paid_amount
    FROM public.bookings b
    JOIN public.pilgrims pl ON pl.booking_id = b.id
    WHERE lower(coalesce(b.status, '')) NOT IN ('canceled', 'cancelled')
    GROUP BY b.id, b.pilgrimage_id
  ),
  pilgrimage_stats AS (
    SELECT
      p.id as p_id,
      coalesce(sum(case when bc.paid_amount >= (p.deposit_value * bc.pax_count) then bc.pax_count else 0 end), 0)::integer as conf,
      coalesce(sum(case when bc.paid_amount < (p.deposit_value * bc.pax_count) then bc.pax_count else 0 end), 0)::integer as pend
    FROM public.pilgrimages p
    LEFT JOIN booking_counts bc ON bc.pilgrimage_id = p.id
    GROUP BY p.id
  )
  SELECT
    p.id,
    p.title,
    p.slug,
    p.description,
    p.cover_image,
    p.start_date,
    p.end_date,
    p.total_vacancies,
    p.current_vacancies,
    p.base_price,
    p.status,
    p.deposit_value,
    ps.conf as confirmed_pax,
    ps.pend as pending_pax,
    -- current_vacancies already has pending+confirmed removed because recalculate_pilgrimage_vacancies calculates all non-cancelled bookings.
    greatest(0, coalesce(p.current_vacancies, p.total_vacancies, 0))::integer as effective_vacancies,
    p.itinerary_summary,
    p.min_deposit,
    p.pricing_config,
    p.meeting_point_text,
    p.meeting_end_text,
    p.flight_info_text,
    p.payment_plan_text,
    p.cancellation_policy_text,
    p.registration_deadline,
    p.flight_price_from,
    p.group_flight_details,
    p.included_items,
    p.not_included_items
  FROM public.pilgrimages p
  JOIN pilgrimage_stats ps ON ps.p_id = p.id
  WHERE (p_slug IS NULL OR p.slug = p_slug)
  ORDER BY p.start_date ASC;
END;
$$;
