-- Ensure member number assignment sees all rows even with RLS enabled on membros.
-- Without SECURITY DEFINER, max(numero_socio) can be computed on a partial set.

create or replace function public.assign_member_number_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  if new.numero_socio is null or btrim(new.numero_socio) = '' then
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
