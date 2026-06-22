-- Phase A2: nav-featuring columns for the new public IA.
-- Lets admins hand-pick which articles surface in the mega-menu / category
-- landing pages. Defaults are off/zero so existing rows stay invisible until
-- explicitly featured via /admin/cms/navigation.

alter table public.wp_pages
  add column if not exists featured_in_nav boolean not null default false,
  add column if not exists nav_sort_order integer not null default 0;

alter table public.posts
  add column if not exists featured_in_nav boolean not null default false,
  add column if not exists nav_sort_order integer not null default 0;

-- Composite indexes to make the per-category featured lookup fast on the
-- public site (where category + featured_in_nav are filtered together).
create index if not exists wp_pages_nav_featured_idx
  on public.wp_pages (category, featured_in_nav, nav_sort_order)
  where featured_in_nav;

-- For posts we use tags[0] as the category proxy (set by 15c-classify),
-- so the index is on (featured_in_nav, nav_sort_order) and the locale +
-- tag filter happens at query time.
create index if not exists posts_nav_featured_idx
  on public.posts (featured_in_nav, nav_sort_order)
  where featured_in_nav;
