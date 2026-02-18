
-- Create general gallery table
create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text, -- Optional caption
  display_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.gallery_images enable row level security;

-- Policies
create policy "Public can view gallery images"
  on public.gallery_images
  for select
  using (is_active = true);

create policy "Admins can manage gallery images"
  on public.gallery_images
  for all
  using (
    auth.role() = 'authenticated'
  );

-- Drop old table if exists (assuming we don't need to migrate data as it's new)
drop table if exists public.pilgrimage_gallery_images;
