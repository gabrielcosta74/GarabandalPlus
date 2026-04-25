create table if not exists public.marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  normalized_email text,
  normalized_phone text,
  display_name text,
  country text,
  language text default 'pt',
  consent_state text not null default 'assumed' check (consent_state in ('assumed', 'explicit', 'unsubscribed', 'suppressed', 'unknown')),
  source_summary jsonb not null default '{}'::jsonb,
  latest_activity_at timestamptz,
  lead_score integer not null default 0 check (lead_score >= 0 and lead_score <= 100),
  lifecycle_stage text not null default 'lead' check (lifecycle_stage in ('lead', 'prospect', 'pilgrim_lead', 'pilgrim', 'donor', 'member', 'supporter', 'suppressed')),
  recommendation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketing_contacts_normalized_email_key
  on public.marketing_contacts (normalized_email)
  where normalized_email is not null;

create unique index if not exists marketing_contacts_normalized_email_upsert_key
  on public.marketing_contacts (normalized_email);

create index if not exists marketing_contacts_stage_score_idx
  on public.marketing_contacts (lifecycle_stage, lead_score desc);

create index if not exists marketing_contacts_latest_activity_idx
  on public.marketing_contacts (latest_activity_at desc);

create table if not exists public.marketing_contact_links (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.marketing_contacts(id) on delete cascade,
  source_table text not null,
  source_id text not null,
  source_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (contact_id, source_table, source_id)
);

create index if not exists marketing_contact_links_source_idx
  on public.marketing_contact_links (source_table, source_id);

create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.marketing_contacts(id) on delete cascade,
  event_type text not null,
  source_table text,
  source_id text,
  title text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (contact_id, event_type, source_table, source_id)
);

create index if not exists marketing_events_contact_time_idx
  on public.marketing_events (contact_id, occurred_at desc);

create table if not exists public.marketing_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  rules jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment_slug text,
  subject text,
  template_key text,
  body text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'completed', 'failed')),
  scheduled_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_funnels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  trigger_type text not null,
  segment_slug text,
  steps jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_enrollments (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.marketing_contacts(id) on delete cascade,
  funnel_id uuid not null references public.marketing_funnels(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'stopped', 'failed')),
  current_step integer not null default 0,
  next_run_at timestamptz,
  goal_reached_at timestamptz,
  stopped_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, funnel_id)
);

create index if not exists marketing_enrollments_due_idx
  on public.marketing_enrollments (status, next_run_at);

create index if not exists marketing_enrollments_funnel_id_idx
  on public.marketing_enrollments (funnel_id);

create table if not exists public.marketing_message_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.marketing_contacts(id) on delete set null,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  funnel_id uuid references public.marketing_funnels(id) on delete set null,
  enrollment_id uuid references public.marketing_enrollments(id) on delete set null,
  email_notification_id uuid references public.email_notifications(id) on delete set null,
  channel text not null default 'email',
  to_email text,
  provider_message_id text,
  subject text,
  template_key text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped', 'test')),
  error_message text,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists marketing_message_logs_contact_time_idx
  on public.marketing_message_logs (contact_id, created_at desc);

create index if not exists marketing_message_logs_campaign_id_idx
  on public.marketing_message_logs (campaign_id);

create index if not exists marketing_message_logs_funnel_id_idx
  on public.marketing_message_logs (funnel_id);

create index if not exists marketing_message_logs_enrollment_id_idx
  on public.marketing_message_logs (enrollment_id);

create index if not exists marketing_message_logs_email_notification_id_idx
  on public.marketing_message_logs (email_notification_id);

create table if not exists public.marketing_tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.marketing_contacts(id) on delete cascade,
  title text not null,
  description text,
  task_type text not null default 'follow_up',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'dismissed')),
  due_at timestamptz,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_tasks_status_priority_idx
  on public.marketing_tasks (status, priority, due_at);

create index if not exists marketing_tasks_contact_id_idx
  on public.marketing_tasks (contact_id);

create table if not exists public.marketing_suppression_list (
  id uuid primary key default gen_random_uuid(),
  normalized_email text,
  normalized_phone text,
  reason text not null,
  source text,
  created_at timestamptz not null default now(),
  unique (normalized_email, reason)
);

create index if not exists marketing_suppression_email_idx
  on public.marketing_suppression_list (normalized_email);

alter table public.marketing_contacts enable row level security;
alter table public.marketing_contact_links enable row level security;
alter table public.marketing_events enable row level security;
alter table public.marketing_segments enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_funnels enable row level security;
alter table public.marketing_enrollments enable row level security;
alter table public.marketing_message_logs enable row level security;
alter table public.marketing_tasks enable row level security;
alter table public.marketing_suppression_list enable row level security;

insert into public.marketing_segments (name, slug, description, rules, is_system)
values
  ('Hot pilgrimage leads', 'hot-pilgrimage-leads', 'High-intent contacts with pilgrimage interest but no booking.', '{"segment":"hot-pilgrimage-leads"}', true),
  ('Abandoned registration', 'abandoned-registration', 'Contacts who started a pilgrimage registration and did not book.', '{"segment":"abandoned-registration"}', true),
  ('Brochure requested but not booked', 'brochure-requested-not-booked', 'Contacts who requested a brochure but have no booking.', '{"segment":"brochure-requested-not-booked"}', true),
  ('Waitlist contacts', 'waitlist-contacts', 'Contacts currently on a pilgrimage waitlist.', '{"segment":"waitlist-contacts"}', true),
  ('Past pilgrims', 'past-pilgrims', 'Contacts with completed or historical pilgrimage participation.', '{"segment":"past-pilgrims"}', true),
  ('Donors not members', 'donors-not-members', 'Succeeded donors without active or historical membership.', '{"segment":"donors-not-members"}', true),
  ('Members without referrals', 'members-without-referrals', 'Members with no recorded referrals.', '{"segment":"members-without-referrals"}', true),
  ('Expired/pending members', 'expired-pending-members', 'Members with expired or pending quota state.', '{"segment":"expired-pending-members"}', true),
  ('High-value supporters', 'high-value-supporters', 'Contacts with meaningful donation, order, pilgrimage, or quota value.', '{"segment":"high-value-supporters"}', true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    rules = excluded.rules,
    is_system = true,
    updated_at = now();

insert into public.marketing_funnels (name, slug, description, trigger_type, segment_slug, steps, status)
values
  ('Brochure nurture', 'brochure-nurture', 'Follow up with brochure request contacts and move them toward booking.', 'brochure_requested', 'brochure-requested-not-booked', '[{"delay_hours":0,"channel":"email","template_key":"brochure_followup_1","condition":"not_booked","stop_if":["booked_pilgrimage","suppressed","unsubscribed"]},{"delay_hours":72,"channel":"email","template_key":"pilgrimage_testimony","condition":"not_booked","stop_if":["booked_pilgrimage","suppressed","unsubscribed"]},{"delay_hours":168,"channel":"task","template_key":"manual_follow_up","condition":"not_booked","stop_if":["booked_pilgrimage","suppressed","unsubscribed"]}]'::jsonb, 'draft'),
  ('Abandoned registration recovery', 'abandoned-registration-recovery', 'Recover contacts who started but did not complete pilgrimage registration.', 'registration_abandoned', 'abandoned-registration', '[{"delay_hours":1,"channel":"email","template_key":"abandoned_registration_1","condition":"not_booked","stop_if":["booked_pilgrimage","suppressed","unsubscribed"]},{"delay_hours":48,"channel":"email","template_key":"abandoned_registration_faq","condition":"not_booked","stop_if":["booked_pilgrimage","suppressed","unsubscribed"]},{"delay_hours":120,"channel":"email","template_key":"abandoned_registration_final","condition":"not_booked","stop_if":["booked_pilgrimage","suppressed","unsubscribed"]},{"delay_hours":168,"channel":"task","template_key":"manual_follow_up","condition":"not_booked","stop_if":["booked_pilgrimage","suppressed","unsubscribed"]}]'::jsonb, 'draft'),
  ('Waitlist conversion', 'waitlist-conversion', 'Notify waitlist contacts when a relevant pilgrimage opens.', 'waitlist_joined', 'waitlist-contacts', '[{"delay_hours":0,"channel":"email","template_key":"waitlist_welcome","stop_if":["booked_pilgrimage","suppressed","unsubscribed"]},{"delay_hours":168,"channel":"task","template_key":"availability_follow_up","condition":"not_booked","stop_if":["booked_pilgrimage","suppressed","unsubscribed"]}]'::jsonb, 'draft'),
  ('Booking payment support', 'booking-payment-support', 'Support confirmed bookings with pending or overdue payment activity.', 'payment_pending', 'hot-pilgrimage-leads', '[{"delay_hours":24,"channel":"email","template_key":"payment_support","condition":"has_pending_payment","stop_if":["suppressed","unsubscribed"]},{"delay_hours":96,"channel":"task","template_key":"payment_manual_follow_up","condition":"has_pending_payment","stop_if":["suppressed","unsubscribed"]}]'::jsonb, 'draft'),
  ('First donation thank-you', 'first-donation-thank-you', 'Thank first-time donors and invite deeper engagement.', 'donation_succeeded', 'donors-not-members', '[{"delay_hours":0,"channel":"email","template_key":"donation_thank_you","stop_if":["suppressed","unsubscribed"]},{"delay_hours":168,"channel":"email","template_key":"donor_to_member","condition":"not_member","stop_if":["became_member","suppressed","unsubscribed"]}]'::jsonb, 'draft'),
  ('Donor to member', 'donor-to-member', 'Invite donors to become members.', 'donation_succeeded', 'donors-not-members', '[{"delay_hours":72,"channel":"email","template_key":"member_invitation","condition":"not_member","stop_if":["became_member","suppressed","unsubscribed"]},{"delay_hours":240,"channel":"task","template_key":"manual_member_invitation","condition":"not_member","stop_if":["became_member","suppressed","unsubscribed"]}]'::jsonb, 'draft'),
  ('Member renewal support', 'member-renewal-support', 'Help pending or expired members renew.', 'quota_expiring', 'expired-pending-members', '[{"delay_hours":0,"channel":"email","template_key":"membership_renewal","stop_if":["suppressed","unsubscribed"]},{"delay_hours":168,"channel":"task","template_key":"renewal_follow_up","stop_if":["suppressed","unsubscribed"]}]'::jsonb, 'draft'),
  ('Member referral activation', 'member-referral-activation', 'Encourage active members to invite others.', 'member_joined', 'members-without-referrals', '[{"delay_hours":72,"channel":"email","template_key":"referral_activation","stop_if":["suppressed","unsubscribed"]},{"delay_hours":336,"channel":"email","template_key":"share_mission","stop_if":["suppressed","unsubscribed"]}]'::jsonb, 'draft')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    trigger_type = excluded.trigger_type,
    segment_slug = excluded.segment_slug,
    steps = excluded.steps,
    updated_at = now();
