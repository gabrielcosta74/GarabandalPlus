-- Extend get_pilgrimage_list to return English translation fields so the
-- /en/pilgrimages and /en/pilgrimages/[slug] pages can render translated
-- titles, descriptions, itinerary summary, and logistics text.

DROP FUNCTION IF EXISTS public.get_pilgrimage_list(text);

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
  not_included_items jsonb,
  title_en text,
  description_en text,
  itinerary_summary_en text,
  meeting_point_text_en text,
  meeting_end_text_en text,
  flight_info_text_en text,
  payment_plan_text_en text,
  cancellation_policy_text_en text,
  transport_description_en text,
  accommodation_description_en text,
  included_items_en jsonb,
  not_included_items_en jsonb,
  group_flight_details_en text
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
    p.not_included_items,
    p.title_en,
    p.description_en,
    p.itinerary_summary_en,
    p.meeting_point_text_en,
    p.meeting_end_text_en,
    p.flight_info_text_en,
    p.payment_plan_text_en,
    p.cancellation_policy_text_en,
    p.transport_description_en,
    p.accommodation_description_en,
    p.included_items_en,
    p.not_included_items_en,
    p.group_flight_details_en
  FROM public.pilgrimages p
  JOIN pilgrimage_stats ps ON ps.p_id = p.id
  WHERE (p_slug IS NULL OR p.slug = p_slug)
  ORDER BY p.start_date ASC;
END;
$$;
