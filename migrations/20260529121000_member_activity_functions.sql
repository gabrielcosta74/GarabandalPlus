-- Aggregation functions for the admin "Atividade dos Membros" section.
-- Called exclusively by the service role (admin API). Execute is revoked from
-- anon/authenticated so they are never exposed through PostgREST to members.

-- Overview KPIs ------------------------------------------------------------
create or replace function public.admin_activity_overview()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total_members',     (select count(*) from membros),
    'activated_members', (select count(distinct user_id) from member_activity),
    'active_today',      (select count(distinct user_id) from member_activity where created_at::date = now()::date),
    'active_7d',         (select count(distinct user_id) from member_activity where created_at > now() - interval '7 days'),
    'active_30d',        (select count(distinct user_id) from member_activity where created_at > now() - interval '30 days'),
    'login_active_7d',   (select count(*) from auth.users u join membros m on m.id = u.id where u.last_sign_in_at > now() - interval '7 days'),
    'login_active_30d',  (select count(*) from auth.users u join membros m on m.id = u.id where u.last_sign_in_at > now() - interval '30 days'),
    'sessions_today',    (select count(distinct session_id) from member_activity where created_at::date = now()::date),
    'sessions_7d',       (select count(distinct session_id) from member_activity where created_at > now() - interval '7 days'),
    'events_7d',         (select count(*) from member_activity where created_at > now() - interval '7 days')
  );
$$;

-- Daily trend within a range ----------------------------------------------
create or replace function public.admin_activity_daily(p_days int default 30)
returns table(day date, sessions bigint, events bigint, active_users bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    d::date as day,
    count(distinct ma.session_id) as sessions,
    count(ma.id) as events,
    count(distinct ma.user_id) as active_users
  from generate_series((now() - make_interval(days => p_days))::date, now()::date, interval '1 day') d
  left join member_activity ma on ma.created_at::date = d::date
  group by d
  order by d;
$$;

-- Feature usage breakdown within a range ----------------------------------
create or replace function public.admin_activity_features(p_days int default 30)
returns table(feature text, events bigint, unique_users bigint, sessions bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    feature,
    count(*) as events,
    count(distinct user_id) as unique_users,
    count(distinct session_id) as sessions
  from member_activity
  where created_at > now() - make_interval(days => p_days)
  group by feature
  order by events desc;
$$;

-- Per-content engagement (incl. never-viewed "dead" content) ---------------
create or replace function public.admin_content_engagement()
returns table(
  content_id uuid,
  title text,
  type text,
  is_published boolean,
  views bigint,
  unique_viewers bigint,
  last_viewed timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.title,
    c.type,
    c.is_published,
    count(ma.id) as views,
    count(distinct ma.user_id) as unique_viewers,
    max(ma.created_at) as last_viewed
  from member_contents c
  left join member_activity ma
    on ma.content_id = c.id and ma.feature = 'content_view'
  group by c.id, c.title, c.type, c.is_published
  order by views desc, c.created_at desc;
$$;

-- Lock down: only the service role may execute these.
revoke execute on function public.admin_activity_overview() from public, anon, authenticated;
revoke execute on function public.admin_activity_daily(int) from public, anon, authenticated;
revoke execute on function public.admin_activity_features(int) from public, anon, authenticated;
revoke execute on function public.admin_content_engagement() from public, anon, authenticated;
grant execute on function public.admin_activity_overview() to service_role;
grant execute on function public.admin_activity_daily(int) to service_role;
grant execute on function public.admin_activity_features(int) to service_role;
grant execute on function public.admin_content_engagement() to service_role;
