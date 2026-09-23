-- Short-lived, single-use bridge from an authenticated mobile booking to the
-- existing first-party web checkout. Only the server's service role can access it.
create table public.mobile_booking_web_handoffs (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  booking_id uuid references public.bookings(id) on delete cascade,
  pilgrimage_slug text,
  user_id uuid not null references auth.users(id) on delete cascade,
  locale text not null check (locale in ('pt', 'en')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint mobile_booking_web_handoffs_expiry check (expires_at > created_at),
  constraint mobile_booking_web_handoffs_target check (
    (booking_id is not null and pilgrimage_slug is null)
    or (booking_id is null and pilgrimage_slug is not null)
  ),
  constraint mobile_booking_web_handoffs_slug check (
    pilgrimage_slug is null or pilgrimage_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  )
);

alter table public.mobile_booking_web_handoffs enable row level security;
revoke all on public.mobile_booking_web_handoffs from public, anon, authenticated;
grant select, insert, update on public.mobile_booking_web_handoffs to service_role;

create index mobile_booking_web_handoffs_expires_at_idx
  on public.mobile_booking_web_handoffs (expires_at);

create index mobile_booking_web_handoffs_booking_id_idx
  on public.mobile_booking_web_handoffs (booking_id) where booking_id is not null;

create index mobile_booking_web_handoffs_user_id_idx
  on public.mobile_booking_web_handoffs (user_id);
