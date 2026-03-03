-- 20260303_revert_vacancies_to_all_bookings.sql

-- 1. Revert `recalculate_pilgrimage_vacancies` to count ALL non-cancelled bookings 
-- instead of only those with paid deposits.
CREATE OR REPLACE FUNCTION public.recalculate_pilgrimage_vacancies(p_pilgrimage_id uuid)
RETURNS table (
  pilgrimage_id uuid,
  total_vacancies integer,
  manual_occupied_pax integer,
  web_occupied_pax integer,
  current_vacancies integer
)
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
  v_total integer;
  v_manual integer;
  v_web integer;
  v_current integer;
BEGIN
  SELECT
    coalesce(p.total_vacancies, 0),
    greatest(0, coalesce(p.manual_occupied_pax, 0))
  INTO
    v_total,
    v_manual
  FROM public.pilgrimages p
  WHERE p.id = p_pilgrimage_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pilgrimage not found: %', p_pilgrimage_id;
  END IF;

  SELECT coalesce(sum(s.pax_count), 0)::integer
  INTO v_web
  FROM (
    SELECT
      b.id,
      count(pl.id)::integer as pax_count
    FROM public.bookings b
    JOIN public.pilgrims pl ON pl.booking_id = b.id
    WHERE b.pilgrimage_id = p_pilgrimage_id
      AND lower(coalesce(b.status, '')) NOT IN ('canceled', 'cancelled')
    GROUP BY b.id
  ) s;

  v_current := greatest(0, v_total - v_manual - coalesce(v_web, 0));

  UPDATE public.pilgrimages p
  SET
    current_vacancies = v_current,
    updated_at = now()
  WHERE p.id = p_pilgrimage_id;

  RETURN QUERY
  SELECT
    p_pilgrimage_id,
    v_total,
    v_manual,
    coalesce(v_web, 0),
    v_current;
END;
$$;

-- 2. Bulk update current_vacancies for all pilgrimages using the reverted logic
WITH web_occupied AS (
  SELECT
    b.pilgrimage_id,
    count(pl.id)::integer as pax_count
  FROM public.bookings b
  JOIN public.pilgrims pl ON pl.booking_id = b.id
  WHERE lower(coalesce(b.status, '')) NOT IN ('canceled', 'cancelled')
  GROUP BY b.pilgrimage_id
)
UPDATE public.pilgrimages p
SET
  current_vacancies = greatest(
    0,
    coalesce(p.total_vacancies, 0)
    - greatest(0, coalesce(p.manual_occupied_pax, 0))
    - coalesce(w.pax_count, 0)
  ),
  updated_at = now()
FROM web_occupied w
WHERE w.pilgrimage_id = p.id;

UPDATE public.pilgrimages p
SET
  current_vacancies = greatest(
    0,
    coalesce(p.total_vacancies, 0)
    - greatest(0, coalesce(p.manual_occupied_pax, 0))
  ),
  updated_at = now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.bookings b
  WHERE b.pilgrimage_id = p.id
    AND lower(coalesce(b.status, '')) NOT IN ('canceled', 'cancelled')
);
