-- Community prayer-intentions wall for novenas.
-- All access goes through SECURITY DEFINER RPCs below; the tables themselves
-- have RLS enabled with NO policies, so direct client access is denied and
-- user_id is never exposed to other members.

create table if not exists novena_intentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  novena_id text,
  author_name text,
  intention text not null,
  is_anonymous boolean not null default false,
  prayer_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists novena_intention_prayers (
  intention_id uuid not null references novena_intentions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (intention_id, user_id)
);

create index if not exists idx_novena_intentions_created on novena_intentions(created_at desc);

alter table novena_intentions enable row level security;
alter table novena_intention_prayers enable row level security;
-- No policies on purpose: only the SECURITY DEFINER functions may touch these.

-- Post a new intention (name resolved server-side to prevent spoofing).
create or replace function public.post_novena_intention(
  p_text text,
  p_novena_id text default null,
  p_anonymous boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_id uuid;
  v_recent int;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if p_text is null or length(trim(p_text)) = 0 then raise exception 'empty intention'; end if;

  -- light anti-spam: max 5 intentions per user per hour
  select count(*) into v_recent from novena_intentions
    where user_id = v_uid and created_at >= now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'rate limit'; end if;

  select coalesce(
    nullif(trim(raw_user_meta_data->>'full_name'), ''),
    nullif(trim(raw_user_meta_data->>'name'), ''),
    initcap(split_part(email, '@', 1))
  ) into v_name from auth.users where id = v_uid;

  insert into novena_intentions(user_id, novena_id, author_name, intention, is_anonymous)
  values (v_uid, p_novena_id, v_name, left(trim(p_text), 280), coalesce(p_anonymous, false))
  returning id into v_id;
  return v_id;
end; $$;

-- List recent intentions with the current user's prayed/owner flags.
create or replace function public.get_novena_intentions(p_limit int default 30)
returns table(
  id uuid,
  novena_id text,
  display_name text,
  intention text,
  prayer_count int,
  created_at timestamptz,
  has_prayed boolean,
  is_mine boolean
)
language sql security definer set search_path = public as $$
  select i.id, i.novena_id,
    case when i.is_anonymous then null else i.author_name end as display_name,
    i.intention, i.prayer_count, i.created_at,
    exists(select 1 from novena_intention_prayers p
             where p.intention_id = i.id and p.user_id = auth.uid()) as has_prayed,
    (i.user_id = auth.uid()) as is_mine
  from novena_intentions i
  order by i.created_at desc
  limit least(coalesce(p_limit, 30), 100);
$$;

-- "I'm praying for you" — idempotent, returns the new prayer count.
create or replace function public.pray_for_intention(p_intention_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_count int;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  insert into novena_intention_prayers(intention_id, user_id)
  values (p_intention_id, v_uid)
  on conflict do nothing;
  update novena_intentions
    set prayer_count = (select count(*) from novena_intention_prayers
                          where intention_id = p_intention_id)
    where id = p_intention_id
    returning prayer_count into v_count;
  return coalesce(v_count, 0);
end; $$;

-- Author can remove their own intention.
create or replace function public.delete_novena_intention(p_intention_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from novena_intentions where id = p_intention_id and user_id = auth.uid();
$$;

-- Lock to signed-in members (Postgres grants EXECUTE to PUBLIC by default).
revoke execute on function public.post_novena_intention(text, text, boolean) from public, anon;
revoke execute on function public.get_novena_intentions(int) from public, anon;
revoke execute on function public.pray_for_intention(uuid) from public, anon;
revoke execute on function public.delete_novena_intention(uuid) from public, anon;

grant execute on function public.post_novena_intention(text, text, boolean) to authenticated;
grant execute on function public.get_novena_intentions(int) to authenticated;
grant execute on function public.pray_for_intention(uuid) to authenticated;
grant execute on function public.delete_novena_intention(uuid) to authenticated;
