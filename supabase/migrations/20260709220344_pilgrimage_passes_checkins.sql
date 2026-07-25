create table if not exists public.pilgrim_passes (
  id uuid primary key default gen_random_uuid(),
  pilgrimage_id uuid not null references public.pilgrimages(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  pilgrim_id uuid not null references public.pilgrims(id) on delete cascade,
  token text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilgrimage_id, pilgrim_id)
);

create index if not exists pilgrim_passes_booking_id_idx on public.pilgrim_passes(booking_id);
create index if not exists pilgrim_passes_pilgrimage_id_idx on public.pilgrim_passes(pilgrimage_id);
create index if not exists pilgrim_passes_token_idx on public.pilgrim_passes(token);

alter table public.pilgrim_passes enable row level security;

create table if not exists public.pilgrimage_checkins (
  id uuid primary key default gen_random_uuid(),
  pilgrimage_id uuid not null references public.pilgrimages(id) on delete cascade,
  pass_id uuid not null references public.pilgrim_passes(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  pilgrim_id uuid not null references public.pilgrims(id) on delete cascade,
  checkpoint_type text not null default 'bus_boarding',
  result text not null check (result in ('accepted', 'duplicate', 'rejected')),
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_email text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pilgrimage_checkins_pilgrimage_checkpoint_idx
  on public.pilgrimage_checkins(pilgrimage_id, checkpoint_type, created_at desc);

create index if not exists pilgrimage_checkins_pass_checkpoint_idx
  on public.pilgrimage_checkins(pass_id, checkpoint_type, created_at desc);

create index if not exists pilgrimage_checkins_booking_id_idx on public.pilgrimage_checkins(booking_id);
create index if not exists pilgrimage_checkins_pilgrim_id_idx on public.pilgrimage_checkins(pilgrim_id);

alter table public.pilgrimage_checkins enable row level security;
