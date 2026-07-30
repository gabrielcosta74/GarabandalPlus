-- Remote hotfix for deployments that received the first version of the
-- reconciliation review gate. COALESCE is PostgreSQL special syntax and
-- cannot be schema-qualified.

create or replace function factpt_private.enforce_review_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(
       new.source_snapshot ->> 'factpt_review_required',
       'false'
     ) = 'true' then
    new.status := 'awaiting_approval';
  elsif new.status = 'pending'
     and new.approved_at is null
     and exists (
       select 1
       from public.factpt_settings as settings
       where settings.environment = new.environment
         and settings.require_approval
     ) then
    new.status := 'awaiting_approval';
  end if;
  return new;
end;
$$;

comment on function factpt_private.enforce_review_gate() is
  'Quarantines globally gated and per-payment review jobs before FACT.pt workers can claim them.';

revoke all on function factpt_private.enforce_review_gate()
  from public, anon, authenticated;
