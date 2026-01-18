-- Migration: Global Site Content
-- Stores global texts like Transport, Accommodation, Inclusions
create table if not exists public.site_content (
  key text primary key,
  content jsonb not null,
  updated_at timestamp with time zone default now()
);

-- Toggle RLS
alter table public.site_content enable row level security;
create policy "Public read access" on public.site_content for select using (true);
create policy "Admin write access" on public.site_content for all using (auth.role() = 'authenticated');

-- Migration: Testimonials
create table if not exists public.testimonials (
  id uuid default gen_random_uuid() primary key,
  author_name text not null,
  role text, -- e.g. "Peregrina em 2024"
  text text not null,
  image_url text,
  display_order int default 0,
  created_at timestamp with time zone default now()
);

-- Toggle RLS
alter table public.testimonials enable row level security;
create policy "Public read access" on public.testimonials for select using (true);
create policy "Admin write access" on public.testimonials for all using (auth.role() = 'authenticated');
