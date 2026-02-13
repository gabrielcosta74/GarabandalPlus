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
  v_web_confirmed integer;
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

  select coalesce(sum(s.confirmed_pax), 0)::integer
  into v_web_confirmed
  from (
    select
      b.id,
      case
        when coalesce(b.paid_amount, 0) >= (coalesce(p.deposit_value, 0) * count(pl.id))
          then count(pl.id)
        else 0
      end as confirmed_pax
    from public.bookings b
    join public.pilgrims pl on pl.booking_id = b.id
    join public.pilgrimages p on p.id = b.pilgrimage_id
    where b.pilgrimage_id = p_pilgrimage_id
      and lower(coalesce(b.status, '')) not in ('canceled', 'cancelled')
    group by b.id, b.paid_amount, p.deposit_value
  ) s;

  v_current := greatest(0, v_total - v_manual - coalesce(v_web_confirmed, 0));

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
    coalesce(v_web_confirmed, 0),
    v_current;
end;
$$;

create or replace function public.create_booking_atomic(
  p_pilgrimage_id uuid,
  p_user_id uuid,
  p_total_amount numeric,
  p_pilgrim_data jsonb,
  p_payment_plan jsonb default null,
  p_notes text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_booking_id uuid;
  v_view_token text;
  v_current_vacancies integer;
  v_total_vacancies integer;
  v_pilgrim record;
  v_slots_needed integer;
begin
  select total_vacancies, current_vacancies
  into v_total_vacancies, v_current_vacancies
  from public.pilgrimages
  where id = p_pilgrimage_id
  for update;

  v_slots_needed := jsonb_array_length(p_pilgrim_data);

  if v_current_vacancies < v_slots_needed then
    raise exception 'Not enough vacancies. Requested: %, Available: %', v_slots_needed, v_current_vacancies;
  end if;

  v_view_token := encode(gen_random_bytes(32), 'hex');

  insert into public.bookings (
    user_id,
    pilgrimage_id,
    total_amount,
    status,
    notes,
    payment_plan,
    view_token,
    idempotency_key
  ) values (
    p_user_id,
    p_pilgrimage_id,
    p_total_amount,
    'pending',
    p_notes,
    p_payment_plan,
    v_view_token,
    p_idempotency_key
  ) returning id into v_booking_id;

  for v_pilgrim in
    select *
    from jsonb_to_recordset(p_pilgrim_data) as x(
      full_name text, email text, phone text, birth_date date,
      sex text, address text, postal_code text, city text, country text,
      room_type text, flight_option text, allergies text, notes text,
      cpf_nif text, dietary_restrictions text, health_notes text,
      bed_preference text, sharing_mode text, roommate_name text
    )
  loop
    insert into public.pilgrims (
      booking_id, full_name, email, phone, birth_date,
      sex, address, postal_code, city, country,
      room_type, flight_option, allergies, notes,
      cpf_nif, dietary_restrictions, health_notes,
      bed_preference, sharing_mode, roommate_name
    ) values (
      v_booking_id, v_pilgrim.full_name, v_pilgrim.email, v_pilgrim.phone, v_pilgrim.birth_date,
      v_pilgrim.sex, v_pilgrim.address, v_pilgrim.postal_code, v_pilgrim.city, v_pilgrim.country,
      v_pilgrim.room_type, v_pilgrim.flight_option, v_pilgrim.allergies, v_pilgrim.notes,
      v_pilgrim.cpf_nif, v_pilgrim.dietary_restrictions, v_pilgrim.health_notes,
      v_pilgrim.bed_preference, v_pilgrim.sharing_mode, v_pilgrim.roommate_name
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'view_token', v_view_token
  );
end;
$$;

with booking_counts as (
  select
    b.pilgrimage_id,
    b.id as booking_id,
    count(pl.id)::integer as pax_count,
    coalesce(b.paid_amount, 0)::numeric as paid_amount
  from public.bookings b
  join public.pilgrims pl on pl.booking_id = b.id
  where lower(coalesce(b.status, '')) not in ('canceled', 'cancelled')
  group by b.pilgrimage_id, b.id, b.paid_amount
),
confirmed as (
  select
    bc.pilgrimage_id,
    coalesce(sum(
      case
        when bc.paid_amount >= (coalesce(p.deposit_value, 0) * bc.pax_count)
          then bc.pax_count
        else 0
      end
    ), 0)::integer as confirmed_pax
  from booking_counts bc
  join public.pilgrimages p on p.id = bc.pilgrimage_id
  group by bc.pilgrimage_id
)
update public.pilgrimages p
set
  current_vacancies = greatest(
    0,
    coalesce(p.total_vacancies, 0)
    - greatest(0, coalesce(p.manual_occupied_pax, 0))
    - coalesce(c.confirmed_pax, 0)
  ),
  updated_at = now()
from confirmed c
where c.pilgrimage_id = p.id;

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
