create or replace function public.assign_member_number_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
  normalized_status text;
begin
  normalized_status := lower(btrim(btrim(coalesce(new.estado_quota, ''), '''')));

  if (new.numero_socio is null or btrim(new.numero_socio) = '')
     and coalesce(new.is_membro, false) = true
     and normalized_status in ('pago', 'paid', 'active') then
    perform pg_advisory_xact_lock(920260219);

    select coalesce(max((numero_socio)::integer), 0) + 1
      into next_number
      from public.membros
     where numero_socio ~ '^[0-9]+$'
       and not (
         coalesce(is_membro, false) = false
         and lower(btrim(btrim(coalesce(estado_quota, ''), ''''))) = 'pendente'
       );

    new.numero_socio := next_number::text;
  end if;

  return new;
end;
$$;

update public.membros
   set numero_socio = null,
       is_membro = false,
       estado_quota = 'pendente',
       proxima_quota = null,
       updated_at = now()
 where numero_socio in ('140', '141', '142')
   and coalesce(is_membro, false) = false
   and lower(btrim(btrim(coalesce(estado_quota, ''), ''''))) = 'pendente';
