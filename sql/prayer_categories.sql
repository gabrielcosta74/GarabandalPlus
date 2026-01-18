-- Create Prayer Categories table
create table if not exists public.prayer_categories (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text not null unique,
    slug text not null unique
);

-- Enable RLS
alter table public.prayer_categories enable row level security;

-- Policies
create policy "Public can view categories"
    on public.prayer_categories for select
    using (true);

create policy "Admins can manage categories"
    on public.prayer_categories for all
    using (auth.role() = 'authenticated');

-- Seed initial categories
insert into public.prayer_categories (name, slug) values
('Garabandal', 'garabandal'),
('Marianas', 'marianas'),
('Diárias', 'diarias'),
('Antífonas', 'antifonas'),
('Rosário', 'rosario'),
('Saints', 'saints'),
('Outras', 'outras')
on conflict (slug) do nothing;
