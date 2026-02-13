-- Guarantees id generation for detailed itinerary inserts even if client sends id = null.
-- Applies to both possible table names found in different environments.

create or replace function public.ensure_row_id()
returns trigger
language plpgsql
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.pilgrimage_itinerary_items') is not null then
    execute 'alter table public.pilgrimage_itinerary_items alter column id set default gen_random_uuid()';
    execute 'drop trigger if exists trg_ensure_row_id_pilgrimage_itinerary_items on public.pilgrimage_itinerary_items';
    execute 'create trigger trg_ensure_row_id_pilgrimage_itinerary_items before insert on public.pilgrimage_itinerary_items for each row execute function public.ensure_row_id()';
  end if;
end$$;

do $$
begin
  if to_regclass('public.pilgramge_itenerary_items') is not null then
    execute 'alter table public.pilgramge_itenerary_items alter column id set default gen_random_uuid()';
    execute 'drop trigger if exists trg_ensure_row_id_pilgramge_itenerary_items on public.pilgramge_itenerary_items';
    execute 'create trigger trg_ensure_row_id_pilgramge_itenerary_items before insert on public.pilgramge_itenerary_items for each row execute function public.ensure_row_id()';
  end if;
end$$;
