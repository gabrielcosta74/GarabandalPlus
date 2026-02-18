
-- Create the gallery images table
create table if not exists public.pilgrimage_gallery_images (
  id uuid primary key default gen_random_uuid(),
  pilgrimage_id uuid references public.pilgrimages(id) on delete cascade not null,
  image_url text not null,
  display_order int default 0,
  is_featured boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.pilgrimage_gallery_images enable row level security;

-- Policies
create policy "Public can view gallery images"
  on public.pilgrimage_gallery_images
  for select
  using (true);

create policy "Admins can manage gallery images"
  on public.pilgrimage_gallery_images
  for all
  using (
    -- Assuming admin check is done via app logic or simple auth for now
    auth.role() = 'authenticated'
  );

-- Create storage bucket if not exists (usually exists)
-- insert into storage.buckets (id, name, public) values ('site-content', 'site-content', true) on conflict do nothing;
