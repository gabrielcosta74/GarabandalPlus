-- Content migration from Webnode (apostoladodegarabandal.com) into the Next app.
-- Adds: wp_pages, posts, media, content_translations, redirects, migration_urls.
-- All migrated content starts as status='draft' and is promoted to 'published' at cutover.

create extension if not exists pgcrypto;

do $$ begin
  create type content_locale as enum ('pt', 'en', 'es');
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_status as enum ('draft', 'scheduled', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type migration_url_status as enum (
    'pending', 'fetched', 'extracted', 'imported', 'verified', 'failed', 'skipped'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Static devotional pages (history, witnesses, teachings, ...)
-- One row per (slug, locale). Translations linked via content_translations.
-- ---------------------------------------------------------------------------
create table if not exists public.wp_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  locale content_locale not null,
  title text not null,
  meta_title text,
  meta_description text,
  og_image_url text,
  excerpt text,
  content_html text,
  content_json jsonb,
  category text,
  parent_slug text,
  status content_status not null default 'draft',
  published_at timestamptz,
  source_url text,
  source_fetched_at timestamptz,
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, locale)
);

create index if not exists wp_pages_status_idx on public.wp_pages (status);
create index if not exists wp_pages_locale_idx on public.wp_pages (locale);
create index if not exists wp_pages_search_idx on public.wp_pages using gin (search_tsv);

-- ---------------------------------------------------------------------------
-- Blog posts (Webnode /l/<slug>)
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  locale content_locale not null,
  title text not null,
  meta_title text,
  meta_description text,
  og_image_url text,
  excerpt text,
  content_html text,
  content_json jsonb,
  cover_image_url text,
  author_id uuid,
  tags text[] not null default '{}',
  status content_status not null default 'draft',
  published_at timestamptz,
  source_url text,
  source_fetched_at timestamptz,
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, locale)
);

create index if not exists posts_status_idx on public.posts (status);
create index if not exists posts_locale_idx on public.posts (locale);
create index if not exists posts_published_at_idx on public.posts (published_at desc);
create index if not exists posts_search_idx on public.posts using gin (search_tsv);

-- ---------------------------------------------------------------------------
-- Media library (images and binaries pulled from Webnode)
-- Hash dedupes identical files re-used across pages.
-- ---------------------------------------------------------------------------
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null default 'posts-media',
  storage_path text not null,
  public_url text not null,
  original_url text,
  filename text,
  mime_type text,
  size_bytes integer,
  width integer,
  height integer,
  alt text,
  hash text unique,
  created_at timestamptz not null default now()
);

create index if not exists media_original_url_idx on public.media (original_url);

-- ---------------------------------------------------------------------------
-- Translation groups: links the PT/EN/ES versions of the same content piece.
-- ---------------------------------------------------------------------------
create table if not exists public.content_translations (
  group_id uuid not null,
  content_type text not null check (content_type in ('page', 'post')),
  content_id uuid not null,
  locale content_locale not null,
  primary key (content_type, content_id),
  unique (group_id, locale)
);

create index if not exists content_translations_group_idx on public.content_translations (group_id);

-- ---------------------------------------------------------------------------
-- Redirects table consumed by middleware.ts (301 by default).
-- ---------------------------------------------------------------------------
create table if not exists public.redirects (
  id bigserial primary key,
  source_path text not null unique,
  destination_path text not null,
  status_code integer not null default 301 check (status_code in (301, 302, 307, 308)),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists redirects_source_idx on public.redirects (source_path);

-- ---------------------------------------------------------------------------
-- Migration control table: one row per Webnode URL. Drives the pipeline.
-- ---------------------------------------------------------------------------
create table if not exists public.migration_urls (
  id bigserial primary key,
  source_url text not null unique,
  url_path text not null,
  locale content_locale not null,
  content_type text not null check (content_type in ('page', 'post', 'redirect-only', 'skip')),
  proposed_slug text,
  proposed_target text,           -- e.g. /a-historia-de-garabandal or /peregrinacoes (when app-keeps)
  decision text not null default 'migrate' check (
    decision in ('migrate', 'app-keeps', 'redirect-only', 'skip')
  ),
  decision_reason text,
  status migration_url_status not null default 'pending',
  http_status integer,
  raw_html_path text,
  error text,
  fetched_at timestamptz,
  extracted_at timestamptz,
  imported_at timestamptz,
  verified_at timestamptz,
  imported_content_type text check (imported_content_type in ('page', 'post')),
  imported_content_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists migration_urls_status_idx on public.migration_urls (status);
create index if not exists migration_urls_decision_idx on public.migration_urls (decision);
create index if not exists migration_urls_locale_idx on public.migration_urls (locale);

-- ---------------------------------------------------------------------------
-- Triggers: keep updated_at fresh and search_tsv populated.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists wp_pages_touch on public.wp_pages;
create trigger wp_pages_touch before update on public.wp_pages
  for each row execute function public.touch_updated_at();

drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

drop trigger if exists migration_urls_touch on public.migration_urls;
create trigger migration_urls_touch before update on public.migration_urls
  for each row execute function public.touch_updated_at();

create or replace function public.wp_pages_search_tsv_update()
returns trigger language plpgsql as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.meta_description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.content_html, '')), 'C');
  return new;
end $$;

drop trigger if exists wp_pages_search on public.wp_pages;
create trigger wp_pages_search before insert or update on public.wp_pages
  for each row execute function public.wp_pages_search_tsv_update();

create or replace function public.posts_search_tsv_update()
returns trigger language plpgsql as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.meta_description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.content_html, '')), 'C');
  return new;
end $$;

drop trigger if exists posts_search on public.posts;
create trigger posts_search before insert or update on public.posts
  for each row execute function public.posts_search_tsv_update();

-- ---------------------------------------------------------------------------
-- RLS: public read for published content; admin writes via service role.
-- Service role bypasses RLS, so we only need read policies for the public.
-- ---------------------------------------------------------------------------
alter table public.wp_pages enable row level security;
alter table public.posts enable row level security;
alter table public.media enable row level security;
alter table public.content_translations enable row level security;
alter table public.redirects enable row level security;
alter table public.migration_urls enable row level security;

drop policy if exists wp_pages_public_read on public.wp_pages;
create policy wp_pages_public_read on public.wp_pages
  for select using (status = 'published');

drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts
  for select using (status = 'published');

drop policy if exists media_public_read on public.media;
create policy media_public_read on public.media for select using (true);

drop policy if exists content_translations_public_read on public.content_translations;
create policy content_translations_public_read on public.content_translations
  for select using (true);

drop policy if exists redirects_public_read on public.redirects;
create policy redirects_public_read on public.redirects for select using (true);

-- migration_urls: no public read. Service role / admin only.

-- ---------------------------------------------------------------------------
-- Storage bucket for migrated media.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('posts-media', 'posts-media', true)
on conflict (id) do nothing;

drop policy if exists "posts-media public read" on storage.objects;
create policy "posts-media public read" on storage.objects
  for select using (bucket_id = 'posts-media');
