-- Flag content that was machine-translated (AI) and not yet reviewed by a human.
-- Set to TRUE by the CMS batch translator; cleared to FALSE whenever an admin
-- manually saves the row in the editor or side-by-side translator (a manual save
-- counts as a human review). Lets the UI mark "IA · por rever" peers so the
-- machine-translated locales (e.g. the unreviewed ES content) are easy to spot.
alter table public.wp_pages add column if not exists mt_unreviewed boolean not null default false;
alter table public.posts    add column if not exists mt_unreviewed boolean not null default false;
