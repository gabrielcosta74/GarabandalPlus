-- Member activity tracking: captures real usage of the members area.
-- Additive only. No payment/checkout/webhook surface is touched.

-- 1. Activity events table -------------------------------------------------
create table if not exists public.member_activity (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  path        text not null,
  feature     text not null,
  content_id  uuid,            -- set when feature = 'content_view' (member_contents.id)
  locale      text not null default 'pt',
  session_id  text,            -- random per browser tab, used to estimate sessions
  created_at  timestamptz not null default now()
);

create index if not exists member_activity_user_created_idx
  on public.member_activity (user_id, created_at desc);
create index if not exists member_activity_feature_created_idx
  on public.member_activity (feature, created_at desc);
create index if not exists member_activity_content_idx
  on public.member_activity (content_id) where content_id is not null;
create index if not exists member_activity_created_idx
  on public.member_activity (created_at desc);

-- 2. RLS: members may only INSERT their own rows. No SELECT policy ->
--    reads happen exclusively through the service role (admin API).
alter table public.member_activity enable row level security;

drop policy if exists member_activity_insert_own on public.member_activity;
create policy member_activity_insert_own
  on public.member_activity
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- 3. Engagement view consumed by the admin API (service role only).
--    Joins membros + auth login recency + activity aggregates.
create or replace view public.admin_member_engagement
with (security_invoker = true) as
select
  m.id                                   as user_id,
  m.nome,
  m.numero_socio,
  m.email,
  m.estado_quota,
  m.is_membro,
  m.data_adesao,
  u.last_sign_in_at,
  a.last_activity_at,
  coalesce(a.events_30d, 0)              as events_30d,
  coalesce(a.sessions_30d, 0)            as sessions_30d,
  a.top_feature
from public.membros m
left join auth.users u on u.id = m.id
left join lateral (
  select
    max(created_at)                                              as last_activity_at,
    count(*) filter (where created_at > now() - interval '30 days') as events_30d,
    count(distinct session_id) filter (where created_at > now() - interval '30 days') as sessions_30d,
    (
      select feature
      from public.member_activity ma2
      where ma2.user_id = m.id
        and ma2.created_at > now() - interval '30 days'
      group by feature
      order by count(*) desc
      limit 1
    ) as top_feature
  from public.member_activity ma
  where ma.user_id = m.id
) a on true;
