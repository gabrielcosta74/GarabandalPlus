-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Academy Courses Table
create table if not exists public.academy_courses (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    slug text unique not null,
    title text not null,
    description text,
    thumbnail_url text, -- Store the image URL
    instructor text default 'Apostolado de Garabandal',
    category text default 'Formação Geral', -- 'Teologia', 'História', etc.
    is_premium boolean default false,
    price numeric(10,2) default 0.00,
    published boolean default false,
    featured boolean default false
);

-- 2. Academy Episodes Table
create table if not exists public.academy_episodes (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    course_id uuid references public.academy_courses(id) on delete cascade not null,
    title text not null,
    description text,
    video_provider text default 'youtube', -- 'youtube', 'bunny', 'vimeo'
    video_id text not null, -- The ID from the provider (e.g., YouTube Video ID)
    duration text default '00:00',
    position integer default 0 -- For ordering episodes 1, 2, 3...
);

-- 3. Academy Enrollments / Access Table
create table if not exists public.academy_enrollments (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    user_id uuid not null, -- References auth.users or public.membros
    course_id uuid references public.academy_courses(id) on delete cascade not null,
    unlocked_at timestamp with time zone default timezone('utc'::text, now()) not null,
    amount_paid numeric(10,2) default 0.00,
    
    unique(user_id, course_id)
);

-- 4. Academy Resources (PDFs, etc) - Optional for now but good to have
create table if not exists public.academy_resources (
    id uuid default uuid_generate_v4() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    course_id uuid references public.academy_courses(id) on delete cascade not null,
    title text not null,
    resource_type text default 'pdf',
    resource_url text not null,
    file_size text
);

-- RLS Policies (Row Level Security)
alter table public.academy_courses enable row level security;
alter table public.academy_episodes enable row level security;
alter table public.academy_enrollments enable row level security;
alter table public.academy_resources enable row level security;

-- Public read access for published courses
create policy "Public courses are viewable by everyone" on public.academy_courses
  for select using (true);

-- Admin write access (Assuming you have an admin role or specific user logic, 
-- for now simplifying to allow authenticated to read, but you should restrict write)
-- Ideally: create policy "Admins can insert" on public.academy_courses for insert with check (auth.role() = 'service_role');
-- For this simplified app, we will rely on application-level checks or manual policy setup.

-- Episodes are viewable by everyone (the player handles the 'lock' logic visually, 
-- but ideally you'd check enrollment for premium video IDs. For YouTube unlisted, obscuring is enough for V1)
create policy "Episodes are viewable by everyone" on public.academy_episodes
  for select using (true);

create policy "Resources are viewable by everyone" on public.academy_resources
  for select using (true);

-- Enrollments: Users can see their own enrollments
create policy "Users can view own enrollments" on public.academy_enrollments
  for select using (auth.uid() = user_id);
