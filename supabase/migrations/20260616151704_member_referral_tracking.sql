-- Add event-level telemetry to member_activity.
-- Existing page-view rows keep working through defaults.

alter table public.member_activity
  add column if not exists event_type text not null default 'page_view',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists member_activity_event_type_created_idx
  on public.member_activity (event_type, created_at desc);

create index if not exists member_activity_referral_events_idx
  on public.member_activity (user_id, event_type, created_at desc)
  where event_type like 'referral_%';
