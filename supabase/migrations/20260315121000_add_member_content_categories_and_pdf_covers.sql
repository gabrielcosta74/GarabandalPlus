create table if not exists public.member_content_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists member_content_categories_name_key
    on public.member_content_categories (lower(name));

create unique index if not exists member_content_categories_slug_key
    on public.member_content_categories (slug);

alter table public.member_content_categories
    enable row level security;

drop policy if exists "Authenticated users can view member content categories" on public.member_content_categories;
create policy "Authenticated users can view member content categories"
    on public.member_content_categories
    for select
    to authenticated
    using (true);

alter table public.member_contents
    add column if not exists cover_image_url text,
    add column if not exists category_id uuid references public.member_content_categories(id) on delete set null;

create index if not exists member_contents_category_id_idx
    on public.member_contents (category_id);
