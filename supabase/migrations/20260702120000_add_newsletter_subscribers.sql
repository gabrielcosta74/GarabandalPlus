-- Newsletter subscribers imported from external ESP (e.g. MailerLite export).
-- These are a *source* for the marketing_contacts projection, exactly like
-- membros / booking_leads. buildMarketingContacts() reads this table and either
-- enriches an existing contact (same email) or creates a fresh prospect.
--
-- Language is taken from the ESP "Groups" column (authoritative), not inferred
-- from country. Spanish (es) is stored but held out of funnels until ES email
-- copy exists. Bounced / unsubscribed rows are NOT stored here — they go to
-- marketing_suppression_list at import time.

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null,
  display_name text,
  language text not null default 'pt' check (language in ('pt', 'en', 'es')),
  group_label text,               -- raw ESP group, e.g. "Peregrinos Língua Portuguesa"
  country text,
  city text,
  consent_state text not null default 'explicit'
    check (consent_state in ('explicit', 'assumed', 'unknown')),
  external_status text,           -- source ESP status at import time (active/…)
  subscribed_at timestamptz,      -- "Created" in the export
  imported_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_email)
);

create index if not exists newsletter_subscribers_language_idx
  on public.newsletter_subscribers (language);

-- Match the rest of the marketing schema: RLS on, no policies => service-role only.
alter table public.newsletter_subscribers enable row level security;

-- Register the newsletter segments so they show up in the admin UI alongside the
-- system segments. The actual tagging happens in evaluateMarketingSegments().
insert into public.marketing_segments (name, slug, description, rules, is_system)
values
  ('Newsletter subscribers', 'newsletter-subscribers', 'Contacts imported from the newsletter / ESP export (explicit opt-in).', '{"segment":"newsletter-subscribers"}', true),
  ('Newsletter · Português', 'newsletter-pt', 'Newsletter subscribers whose list language is Portuguese.', '{"segment":"newsletter-pt"}', true),
  ('Newsletter · English', 'newsletter-en', 'Newsletter subscribers whose list language is English.', '{"segment":"newsletter-en"}', true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    rules = excluded.rules,
    is_system = true;
