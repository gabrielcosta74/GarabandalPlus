-- Private FACT.pt pilgrimage fixtures reuse pricing_config JSONB so the
-- production pilgrimage schema does not gain permanent test-only columns.
-- A row carrying private_test_user_id is invisible through public RLS and the
-- SECURITY DEFINER listing RPC. The booking/account-holder APIs remain the
-- only user-facing access path.

alter policy "Public can view open pilgrimages" on public.pilgrimages
using (
  nullif(pricing_config ->> 'private_test_user_id', '') is null
  and not (
    coalesce((pricing_config -> 'early_access' ->> 'enabled')::boolean, false)
    and (pricing_config -> 'early_access' ->> 'public_launch_at') is not null
    and now() < (pricing_config -> 'early_access' ->> 'public_launch_at')::timestamptz
  )
);

alter policy "Authenticated can view all pilgrimages" on public.pilgrimages
using (
  nullif(pricing_config ->> 'private_test_user_id', '') is null
);

-- These foreign-key access paths are also used by the owner-only booking
-- endpoint and by the FACT.pt source snapshot loader.
create index if not exists idx_bookings_user_id
  on public.bookings (user_id);

create index if not exists idx_pilgrimage_payments_booking_id
  on public.pilgrimage_payments (booking_id);

create index if not exists idx_pilgrimage_payments_user_id
  on public.pilgrimage_payments (user_id);

create or replace function public.get_pilgrimage_list(p_slug text default null::text)
returns table(
  id uuid,
  title text,
  slug text,
  description text,
  cover_image text,
  cover_image_en text,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
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
  registration_deadline timestamp with time zone,
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
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with booking_counts as (
    select
      bookings.pilgrimage_id,
      count(pilgrims.id) as pax_count,
      bookings.id as booking_id,
      bookings.paid_amount
    from public.bookings
    join public.pilgrims on pilgrims.booking_id = bookings.id
    where lower(coalesce(bookings.status, '')) not in ('canceled', 'cancelled')
    group by bookings.id, bookings.pilgrimage_id
  ),
  pilgrimage_stats as (
    select
      pilgrimages.id as pilgrimage_id,
      coalesce(
        sum(
          case
            when booking_counts.paid_amount >= (
              pilgrimages.deposit_value * booking_counts.pax_count
            )
              then booking_counts.pax_count
            else 0
          end
        ),
        0
      )::integer as confirmed_count,
      coalesce(
        sum(
          case
            when booking_counts.paid_amount < (
              pilgrimages.deposit_value * booking_counts.pax_count
            )
              then booking_counts.pax_count
            else 0
          end
        ),
        0
      )::integer as pending_count
    from public.pilgrimages
    left join booking_counts
      on booking_counts.pilgrimage_id = pilgrimages.id
    group by pilgrimages.id
  )
  select
    pilgrimages.id,
    pilgrimages.title,
    pilgrimages.slug,
    pilgrimages.description,
    pilgrimages.cover_image,
    pilgrimages.cover_image_en,
    pilgrimages.start_date,
    pilgrimages.end_date,
    pilgrimages.total_vacancies,
    pilgrimages.current_vacancies,
    pilgrimages.base_price,
    pilgrimages.status,
    pilgrimages.deposit_value,
    pilgrimage_stats.confirmed_count,
    pilgrimage_stats.pending_count,
    greatest(
      0,
      coalesce(
        pilgrimages.current_vacancies,
        pilgrimages.total_vacancies,
        0
      )
    )::integer,
    pilgrimages.itinerary_summary,
    pilgrimages.min_deposit,
    pilgrimages.pricing_config,
    pilgrimages.meeting_point_text,
    pilgrimages.meeting_end_text,
    pilgrimages.flight_info_text,
    pilgrimages.payment_plan_text,
    pilgrimages.cancellation_policy_text,
    pilgrimages.registration_deadline,
    pilgrimages.flight_price_from,
    pilgrimages.group_flight_details,
    pilgrimages.included_items,
    pilgrimages.not_included_items,
    pilgrimages.title_en,
    pilgrimages.description_en,
    pilgrimages.itinerary_summary_en,
    pilgrimages.meeting_point_text_en,
    pilgrimages.meeting_end_text_en,
    pilgrimages.flight_info_text_en,
    pilgrimages.payment_plan_text_en,
    pilgrimages.cancellation_policy_text_en,
    pilgrimages.transport_description_en,
    pilgrimages.accommodation_description_en,
    pilgrimages.included_items_en,
    pilgrimages.not_included_items_en,
    pilgrimages.group_flight_details_en
  from public.pilgrimages
  join pilgrimage_stats
    on pilgrimage_stats.pilgrimage_id = pilgrimages.id
  where (p_slug is null or pilgrimages.slug = p_slug)
    and nullif(
      pilgrimages.pricing_config ->> 'private_test_user_id',
      ''
    ) is null
    and not (
      coalesce(
        (
          pilgrimages.pricing_config
            -> 'early_access'
            ->> 'enabled'
        )::boolean,
        false
      )
      and (
        pilgrimages.pricing_config
          -> 'early_access'
          ->> 'public_launch_at'
      ) is not null
      and now() < (
        pilgrimages.pricing_config
          -> 'early_access'
          ->> 'public_launch_at'
      )::timestamptz
    )
  order by pilgrimages.start_date asc;
end;
$$;

comment on function public.get_pilgrimage_list(text) is
  'Public pilgrimage list/detail RPC; private FACT.pt fixtures are always excluded.';
