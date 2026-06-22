-- Harden store-credit RPCs used by referrals and checkout.
-- These functions are called from server-side code with the service role.
-- They must not be callable directly by anon/authenticated clients.

drop function if exists public.reward_inviter(text, numeric);

create table if not exists public.referral_rewards (
  id bigint generated always as identity primary key,
  referral_code text not null,
  inviter_id uuid not null references public.membros(id) on delete cascade,
  new_member_id uuid not null references public.membros(id) on delete cascade,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (new_member_id)
);

create index if not exists referral_rewards_inviter_created_idx
  on public.referral_rewards (inviter_id, created_at desc);

alter table public.referral_rewards enable row level security;

revoke all on table public.referral_rewards from public, anon, authenticated;

insert into public.referral_rewards (
  referral_code,
  inviter_id,
  new_member_id,
  amount,
  created_at
)
select
  invited.referred_by_code,
  inviter.id,
  invited.id,
  2.50,
  coalesce(invited.data_adesao::timestamptz, now())
from public.membros invited
join public.membros inviter
  on inviter.referral_code = invited.referred_by_code
where invited.referred_by_code is not null
  and invited.referred_by_code <> ''
  and invited.id <> inviter.id
  and coalesce(invited.is_membro, false) = true
on conflict (new_member_id) do nothing;

create or replace function public.reward_inviter(
  p_referral_code text,
  p_new_member_id uuid,
  p_amount numeric default 2.50
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := nullif(trim(p_referral_code), '');
  v_reward_amount numeric := 2.50;
  v_inviter_id uuid;
  v_reward_id bigint;
begin
  if v_code is null or p_new_member_id is null then
    return;
  end if;

  select id
    into v_inviter_id
  from public.membros
  where referral_code = v_code
    and id <> p_new_member_id
  limit 1;

  if v_inviter_id is null then
    return;
  end if;

  -- Require the new member to still carry the referral code. This prevents a
  -- privileged caller from crediting arbitrary accounts with unrelated codes.
  if not exists (
    select 1
    from public.membros
    where id = p_new_member_id
      and referred_by_code = v_code
      and coalesce(is_membro, false) = true
  ) then
    return;
  end if;

  insert into public.referral_rewards (
    referral_code,
    inviter_id,
    new_member_id,
    amount
  )
  values (
    v_code,
    v_inviter_id,
    p_new_member_id,
    v_reward_amount
  )
  on conflict (new_member_id) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    return;
  end if;

  update public.membros
  set store_credits = coalesce(store_credits, 0) + v_reward_amount,
      referrals_count = coalesce(referrals_count, 0) + 1,
      updated_at = now()
  where id = v_inviter_id;

  update public.membros
  set store_credits = coalesce(store_credits, 0) + v_reward_amount,
      updated_at = now()
  where id = p_new_member_id;
end;
$$;

create or replace function public.deduct_store_credits(
  p_user_id uuid,
  p_amount numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_amount is null or p_amount <= 0 then
    return false;
  end if;

  update public.membros
  set store_credits = coalesce(store_credits, 0) - p_amount,
      updated_at = now()
  where id = p_user_id
    and coalesce(store_credits, 0) >= p_amount;

  return found;
end;
$$;

revoke execute on function public.reward_inviter(text, uuid, numeric) from public, anon, authenticated;
revoke execute on function public.deduct_store_credits(uuid, numeric) from public, anon, authenticated;

grant execute on function public.reward_inviter(text, uuid, numeric) to service_role;
grant execute on function public.deduct_store_credits(uuid, numeric) to service_role;

comment on function public.reward_inviter(text, uuid, numeric)
  is 'Server-only referral reward RPC. The reward amount is fixed inside the function; p_amount is kept for API compatibility.';

comment on function public.deduct_store_credits(uuid, numeric)
  is 'Server-only atomic store-credit debit RPC for paid store orders.';
