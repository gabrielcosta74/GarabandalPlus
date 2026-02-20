-- Fix member number generation to avoid unique conflicts when sequence is behind.
-- Also ensures next number is always max(existing)+1, matching business expectation.

alter table public.membros
  alter column numero_socio drop default;

create or replace function public.assign_member_number_on_insert()
returns trigger
language plpgsql
as $$
declare
  next_number integer;
begin
  if new.numero_socio is null or btrim(new.numero_socio) = '' then
    -- Serialize number assignment to avoid races in concurrent inserts.
    perform pg_advisory_xact_lock(920260219);

    select coalesce(max((numero_socio)::integer), 0) + 1
      into next_number
      from public.membros
     where numero_socio ~ '^[0-9]+$';

    new.numero_socio := next_number::text;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assign_member_number_on_insert on public.membros;

create trigger trg_assign_member_number_on_insert
before insert on public.membros
for each row
execute function public.assign_member_number_on_insert();

-- Keep sequence aligned for any legacy paths that still call nextval directly.
select setval(
  'public.member_number_seq',
  coalesce((select max((numero_socio)::integer) from public.membros where numero_socio ~ '^[0-9]+$'), 0),
  true
);
