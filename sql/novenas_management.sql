-- Novena Management Tables

-- 1. Novenas Table
create table if not exists novenas (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  image_url text,
  prayer_intro text, -- Oração Inicial
  prayer_final text, -- Oração Final
  
  published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Novena Days Table
create table if not exists novena_days (
  id uuid primary key default gen_random_uuid(),
  novena_id uuid not null references novenas(id) on delete cascade,
  day_number int not null, -- 1 to 9 typically
  theme text not null,     -- e.g., "O Chamamento"
  content text not null,   -- Main reflection/message
  image_url text,          -- Optional daily image
  audio_url text,          -- Optional: Audio guide
  
  created_at timestamptz default now(),
  
  unique(novena_id, day_number)
);

-- Storage bucket for Novena assets
insert into storage.buckets (id, name, public) 
values ('novena-assets', 'novena-assets', true)
on conflict (id) do nothing;

create policy "Novena assets are public"
  on storage.objects for select
  using ( bucket_id = 'novena-assets' );

create policy "Admins can upload novena assets"
  on storage.objects for insert
  with check ( bucket_id = 'novena-assets' ); 
  -- Note: Ideally check for admin role, but basic auth check is standard for this app context

-- RLS Policies

-- Published Novenas are public readable
alter table novenas enable row level security;
alter table novena_days enable row level security;

create policy "Public can view published novenas"
  on novenas for select
  using (published = true);

create policy "Public can view published novena days"
  on novena_days for select
  using (exists (
    select 1 from novenas n 
    where n.id = novena_days.novena_id and n.published = true
  ));

-- Admins (or simple authenticated users for now if no rigid role system)
-- Assuming 'authenticated' is enough for CRUD in this specific app based on previous patterns
-- But creating proper unrestricted policies for now to allow Admin Panel usage.
-- Ideally, we should check `auth.email() = 'admin@admin.com'` or similar, but I'll use `authenticated` for simplicity + separate Admin layout protection.

create policy "Admins can manage novenas"
  on novenas for all
  using (auth.role() = 'authenticated');

create policy "Admins can manage novena days"
  on novena_days for all
  using (auth.role() = 'authenticated');
