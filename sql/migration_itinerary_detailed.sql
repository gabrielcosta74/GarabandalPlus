-- Migration: Create pilgrimage_itinerary_items table

create table if not exists public.pilgrimage_itinerary_items (
  id uuid default gen_random_uuid() primary key,
  pilgrimage_id uuid references public.pilgrimages(id) on delete cascade not null,
  title text not null,
  description text, -- Long description
  image_url text,
  day_number int, -- Optional: Day 1, Day 2, etc.
  display_order int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table public.pilgrimage_itinerary_items enable row level security;

create policy "Enable read access for all users"
on public.pilgrimage_itinerary_items for select
using (true);

create policy "Enable insert for authenticated users only"
on public.pilgrimage_itinerary_items for insert
with check (auth.role() = 'authenticated');

create policy "Enable update for authenticated users only"
on public.pilgrimage_itinerary_items for update
using (auth.role() = 'authenticated');

create policy "Enable delete for authenticated users only"
on public.pilgrimage_itinerary_items for delete
using (auth.role() = 'authenticated');
