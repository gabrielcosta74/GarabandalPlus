-- Enable RLS for sensitive pilgrimage booking tables.
-- Safety guard: only enable when expected policies already exist.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bookings'
      and policyname = 'Users can view own bookings'
  ) then
    raise exception 'Missing policy: public.bookings -> Users can view own bookings';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bookings'
      and policyname = 'Users can create own bookings'
  ) then
    raise exception 'Missing policy: public.bookings -> Users can create own bookings';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pilgrims'
      and policyname = 'Users can manage own pilgrims'
  ) then
    raise exception 'Missing policy: public.pilgrims -> Users can manage own pilgrims';
  end if;
end $$;

alter table if exists public.bookings enable row level security;
alter table if exists public.pilgrims enable row level security;
