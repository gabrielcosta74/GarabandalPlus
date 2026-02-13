alter table public.pilgrimages
add column if not exists manual_occupied_pax integer not null default 0;

with web_occupied as (
  select
    b.pilgrimage_id,
    count(pl.id)::integer as pax_count
  from public.bookings b
  left join public.pilgrims pl on pl.booking_id = b.id
  where lower(coalesce(b.status, '')) not in ('canceled', 'cancelled')
  group by b.pilgrimage_id
)
update public.pilgrimages p
set manual_occupied_pax = greatest(
  0,
  coalesce(p.total_vacancies, 0)
  - coalesce(p.current_vacancies, p.total_vacancies, 0)
  - coalesce(w.pax_count, 0)
)
from web_occupied w
where w.pilgrimage_id = p.id
  and coalesce(p.manual_occupied_pax, 0) = 0;

create or replace function public.recalculate_pilgrimage_vacancies(p_pilgrimage_id uuid)
returns table (
  pilgrimage_id uuid,
  total_vacancies integer,
  manual_occupied_pax integer,
  web_occupied_pax integer,
  current_vacancies integer
)
language plpgsql
security definer
as $$
declare
  v_total integer;
  v_manual integer;
  v_web integer;
  v_current integer;
begin
  select
    coalesce(p.total_vacancies, 0),
    greatest(0, coalesce(p.manual_occupied_pax, 0))
  into
    v_total,
    v_manual
  from public.pilgrimages p
  where p.id = p_pilgrimage_id
  for update;

  if not found then
    raise exception 'Pilgrimage not found: %', p_pilgrimage_id;
  end if;

  select coalesce(sum(s.pax_count), 0)::integer
  into v_web
  from (
    select
      b.id,
      count(pl.id)::integer as pax_count
    from public.bookings b
    left join public.pilgrims pl on pl.booking_id = b.id
    where b.pilgrimage_id = p_pilgrimage_id
      and lower(coalesce(b.status, '')) not in ('canceled', 'cancelled')
    group by b.id
  ) s;

  v_current := greatest(0, v_total - v_manual - coalesce(v_web, 0));

  update public.pilgrimages p
  set
    current_vacancies = v_current,
    updated_at = now()
  where p.id = p_pilgrimage_id;

  return query
  select
    p_pilgrimage_id,
    v_total,
    v_manual,
    coalesce(v_web, 0),
    v_current;
end;
$$;

create or replace function public.get_pilgrimage_list(p_slug text default null)
returns table(
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
language plpgsql
security definer
as $$
begin
  return query
  with booking_counts as (
    select
      b.pilgrimage_id,
      count(pl.id) as pax_count,
      b.id as booking_id,
      b.paid_amount
    from public.bookings b
    join public.pilgrims pl on pl.booking_id = b.id
    where lower(coalesce(b.status, '')) not in ('canceled', 'cancelled')
    group by b.id, b.pilgrimage_id
  ),
  pilgrimage_stats as (
    select
      p.id as p_id,
      coalesce(sum(case when bc.paid_amount >= (p.deposit_value * bc.pax_count) then bc.pax_count else 0 end), 0)::integer as conf,
      coalesce(sum(case when bc.paid_amount < (p.deposit_value * bc.pax_count) then bc.pax_count else 0 end), 0)::integer as pend
    from public.pilgrimages p
    left join booking_counts bc on bc.pilgrimage_id = p.id
    group by p.id
  )
  select
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
    p.not_included_items
  from public.pilgrimages p
  join pilgrimage_stats ps on ps.p_id = p.id
  where (p_slug is null or p.slug = p_slug)
  order by p.start_date asc;
end;
$$;

create or replace view public.v_pilgrimage_occupancy as
with booking_counts as (
  select
    b.id as booking_id,
    count(pl.id)::integer as pax_count
  from public.bookings b
  join public.pilgrims pl on pl.booking_id = b.id
  where lower(coalesce(b.status, '')) not in ('canceled', 'cancelled')
  group by b.id
),
booking_status as (
  select
    b.pilgrimage_id,
    b.id as booking_id,
    bc.pax_count,
    b.paid_amount,
    p.deposit_value,
    (b.paid_amount >= (p.deposit_value * bc.pax_count::numeric)) as is_confirmed
  from public.bookings b
  join booking_counts bc on bc.booking_id = b.id
  join public.pilgrimages p on p.id = b.pilgrimage_id
  where lower(coalesce(b.status, '')) not in ('canceled', 'cancelled')
)
select
  p.id as pilgrimage_id,
  p.total_vacancies,
  coalesce(sum(case when bs.is_confirmed then bs.pax_count else 0 end), 0)::integer as confirmed_pax,
  coalesce(sum(case when not bs.is_confirmed then bs.pax_count else 0 end), 0)::integer as pending_pax,
  greatest(0, coalesce(p.current_vacancies, p.total_vacancies, 0))::integer as effective_vacancies
from public.pilgrimages p
left join booking_status bs on bs.pilgrimage_id = p.id
group by p.id, p.total_vacancies, p.current_vacancies;

with web_occupied as (
  select
    b.pilgrimage_id,
    count(pl.id)::integer as pax_count
  from public.bookings b
  join public.pilgrims pl on pl.booking_id = b.id
  where lower(coalesce(b.status, '')) not in ('canceled', 'cancelled')
  group by b.pilgrimage_id
)
update public.pilgrimages p
set
  current_vacancies = greatest(
    0,
    coalesce(p.total_vacancies, 0)
    - greatest(0, coalesce(p.manual_occupied_pax, 0))
    - coalesce(w.pax_count, 0)
  ),
  updated_at = now()
from web_occupied w
where w.pilgrimage_id = p.id;

update public.pilgrimages p
set
  current_vacancies = greatest(
    0,
    coalesce(p.total_vacancies, 0)
    - greatest(0, coalesce(p.manual_occupied_pax, 0))
  ),
  updated_at = now()
where not exists (
  select 1
  from public.bookings b
  where b.pilgrimage_id = p.id
    and lower(coalesce(b.status, '')) not in ('canceled', 'cancelled')
);
