-- Community stats for novenas (privacy-safe aggregates)
--
-- novena_progress / novena_history have own-only RLS, so members cannot read
-- each other's rows. These SECURITY DEFINER functions expose ONLY aggregate
-- counts (never user ids or intentions), giving a sense of communion without
-- leaking anyone's private prayer activity.
--
-- "Active" = members on an in-progress journey touched within the last 14 days.

-- 1. Global community communion stats
create or replace function public.get_novena_community_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total_completed',
      (select count(*) from novena_history),
    'completed_this_month',
      (select count(*) from novena_history
        where completed_at >= date_trunc('month', now())),
    'active_now',
      (select count(distinct user_id) from novena_progress
        where is_complete = false
          and updated_at >= now() - interval '7 days')
  );
$$;

revoke execute on function public.get_novena_community_stats() from public, anon;
grant execute on function public.get_novena_community_stats() to authenticated;

-- 2. Per-novena count of members currently on the journey
create or replace function public.get_novena_active_counts()
returns table(novena_id text, active_count bigint)
language sql
security definer
set search_path = public
as $$
  select novena_id, count(distinct user_id) as active_count
  from novena_progress
  where is_complete = false
    and updated_at >= now() - interval '14 days'
  group by novena_id;
$$;

revoke execute on function public.get_novena_active_counts() from public, anon;
grant execute on function public.get_novena_active_counts() to authenticated;
