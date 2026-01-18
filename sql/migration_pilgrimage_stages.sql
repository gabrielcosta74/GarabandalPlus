-- Migration: Pilgrimage Stages (Itinerary)
-- Description: Stores specific locations/steps for the 3D Pilgrimage Itinerary.

create table if not exists pilgrimage_stages (
  id uuid default gen_random_uuid() primary key,
  pilgrimage_id uuid references pilgrimages(id) on delete cascade not null,
  title text not null,          -- e.g. "Paris: A Cidade Luz"
  description text,             -- e.g. "Visita à Medalha Milagrosa..."
  image_url text,               -- e.g. URL to scenic photo
  lat double precision not null,
  lng double precision not null,
  display_order integer default 0,
  
  -- For day-by-day itineraries (optional, can be null if it's just a location highlight)
  day_number integer,
  
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table pilgrimage_stages enable row level security;

-- Policies: Public Read, Admin Write
create policy "Public can view pilgrimage stages"
  on pilgrimage_stages for select
  using (true);
