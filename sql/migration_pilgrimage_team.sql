-- Migration: Pilgrimage Team Members
-- Description: Stores team members and special guests for a specific pilgrimage.

create table if not exists public.pilgrimage_team_members (
  id uuid default gen_random_uuid() primary key,
  pilgrimage_id uuid references public.pilgrimages(id) on delete cascade not null,
  name text not null,
  role text not null,           -- e.g. "Diretor Espiritual", "Guia", "Staff"
  country text,                 -- e.g. "Portugal", "Espanha"
  image_url text,               -- Profile picture URL
  is_special_guest boolean default false, -- If true, shown in prominent section
  description text,             -- Bio for special guests
  display_order integer default 0,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.pilgrimage_team_members enable row level security;

-- Policies
create policy "Public can view team members"
  on public.pilgrimage_team_members for select
  using (true);

create policy "Admins can insert team members"
  on public.pilgrimage_team_members for insert
  with check (auth.role() = 'authenticated');

create policy "Admins can update team members"
  on public.pilgrimage_team_members for update
  using (auth.role() = 'authenticated');

create policy "Admins can delete team members"
  on public.pilgrimage_team_members for delete
  using (auth.role() = 'authenticated');
