-- Create Prayers table
create table if not exists public.prayers (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    title text not null,
    slug text not null unique,
    content text not null, -- Rich text or plain text
    preview text, -- Short excerpt
    category text not null, -- e.g., 'Marianas', 'Garabandal', 'Diárias'
    
    image_url text,
    audio_url text, -- For guided prayer
    
    published boolean default false,
    featured boolean default false -- For highlighting specific prayers
);

-- Enable RLS
alter table public.prayers enable row level security;

-- Policies
create policy "Public prayers are viewable by everyone"
    on public.prayers for select
    using (published = true);

-- Allow authenticated users (Admins) to manage prayers
-- Note: Adjust this if you have a specific 'admin' role or table in the future
create policy "Admins can do everything with prayers"
    on public.prayers for all
    using (auth.role() = 'authenticated');

-- Create bucket for prayer assets if not exists
insert into storage.buckets (id, name, public)
values ('prayer-assets', 'prayer-assets', true)
on conflict (id) do nothing;

create policy "Prayer assets are publicly accessible"
    on storage.objects for select
    using ( bucket_id = 'prayer-assets' );

create policy "Admins can upload prayer assets"
    on storage.objects for insert
    with check (
        bucket_id = 'prayer-assets' and
        auth.role() = 'authenticated'
    );

create policy "Admins can update prayer assets"
    on storage.objects for update
    using (
        bucket_id = 'prayer-assets' and
        auth.role() = 'authenticated'
    );

create policy "Admins can delete prayer assets"
    on storage.objects for delete
    using (
        bucket_id = 'prayer-assets' and
        auth.role() = 'authenticated'
    );
