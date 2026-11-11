-- Hotéis da logística: linhas da proforma, prestações e contactos.
--
-- O admin escreve as linhas tal como vêm na proforma do hotel (quartos,
-- suplementos, descontos, taxas) e o plano de pagamentos (normalmente 3
-- prestações). O que está pago continua a vir do banco, pelo acordo da
-- Contabilidade (supplier_agreements); as prestações só dizem quando pagar.

alter table public.pilgrimage_hotel_stays
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists option_until date,
  add column if not exists rooming_list_due date;

create table if not exists public.pilgrimage_hotel_lines (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.pilgrimage_hotel_stays(id) on delete cascade,
  kind text not null default 'room' check (kind in ('room', 'supplement', 'discount', 'tax', 'other')),
  label text not null default '',
  qty numeric(10, 2) not null default 0,
  nights integer not null default 1 check (nights >= 0),
  unit_price numeric(12, 2) not null default 0,
  -- Pago no hotel, à chegada, e não por transferência: fica fora do acordo.
  pay_on_site boolean not null default false,
  notes text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pilgrimage_hotel_lines_stay_idx on public.pilgrimage_hotel_lines(stay_id, display_order);

create table if not exists public.pilgrimage_hotel_installments (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.pilgrimage_hotel_stays(id) on delete cascade,
  label text not null default '',
  due_date date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  notes text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pilgrimage_hotel_installments_stay_idx on public.pilgrimage_hotel_installments(stay_id, due_date);

drop trigger if exists pilgrimage_hotel_lines_touch on public.pilgrimage_hotel_lines;
create trigger pilgrimage_hotel_lines_touch before update on public.pilgrimage_hotel_lines
  for each row execute function public.touch_updated_at();
drop trigger if exists pilgrimage_hotel_installments_touch on public.pilgrimage_hotel_installments;
create trigger pilgrimage_hotel_installments_touch before update on public.pilgrimage_hotel_installments
  for each row execute function public.touch_updated_at();

-- Só o servidor (rotas de admin) lê e escreve.
alter table public.pilgrimage_hotel_lines enable row level security;
alter table public.pilgrimage_hotel_installments enable row level security;
revoke all on public.pilgrimage_hotel_lines from anon, authenticated;
revoke all on public.pilgrimage_hotel_installments from anon, authenticated;
grant select, insert, update, delete on public.pilgrimage_hotel_lines to service_role;
grant select, insert, update, delete on public.pilgrimage_hotel_installments to service_role;

-- Junta duas estadias seguidas do mesmo hotel numa só (ex.: uma linha por
-- regime). Os preços da fórmula passam a média ponderada pelas noites, o que
-- mantém o total exatamente igual. Linhas e prestações passam para a estadia
-- que fica. Recusa se a que sai tiver acordo na Contabilidade.
create or replace function public.logistics_merge_stays(p_keep uuid, p_drop uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_keep public.pilgrimage_hotel_stays%rowtype;
  v_drop public.pilgrimage_hotel_stays%rowtype;
  v_first public.pilgrimage_hotel_stays%rowtype;
  v_second public.pilgrimage_hotel_stays%rowtype;
  n_keep numeric;
  n_drop numeric;
  n_all numeric;
begin
  select * into v_keep from public.pilgrimage_hotel_stays where id = p_keep for update;
  select * into v_drop from public.pilgrimage_hotel_stays where id = p_drop for update;
  if v_keep.id is null or v_drop.id is null or p_keep = p_drop then
    raise exception 'Estadia não encontrada.' using errcode = 'P0001';
  end if;
  if v_keep.pilgrimage_id <> v_drop.pilgrimage_id then
    raise exception 'As estadias são de peregrinações diferentes.' using errcode = 'P0001';
  end if;
  if v_keep.check_in <= v_drop.check_in then v_first := v_keep; v_second := v_drop;
  else v_first := v_drop; v_second := v_keep; end if;
  if v_first.check_out <> v_second.check_in then
    raise exception 'Só se juntam estadias seguidas (a saída de uma é a entrada da outra).' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.supplier_agreements where hotel_stay_id = p_drop and status = 'open') then
    raise exception 'A estadia que sai tem acordo na Contabilidade. Mude o acordo primeiro.' using errcode = 'P0001';
  end if;

  n_keep := greatest(v_keep.check_out - v_keep.check_in, 0);
  n_drop := greatest(v_drop.check_out - v_drop.check_in, 0);
  n_all := nullif(n_keep + n_drop, 0);

  update public.pilgrimage_hotel_lines set stay_id = p_keep, display_order = display_order + 1000 where stay_id = p_drop;
  update public.pilgrimage_hotel_installments set stay_id = p_keep where stay_id = p_drop;

  update public.pilgrimage_hotel_stays set
    check_in = v_first.check_in,
    check_out = v_second.check_out,
    shared_price_per_night = round(coalesce((v_keep.shared_price_per_night * n_keep + v_drop.shared_price_per_night * n_drop) / n_all, v_keep.shared_price_per_night), 2),
    single_supplement_per_night = round(coalesce((v_keep.single_supplement_per_night * n_keep + v_drop.single_supplement_per_night * n_drop) / n_all, v_keep.single_supplement_per_night), 2),
    city_tax_per_person_night = round(coalesce((v_keep.city_tax_per_person_night * n_keep + v_drop.city_tax_per_person_night * n_drop) / n_all, v_keep.city_tax_per_person_night), 2),
    notes = nullif(concat_ws(E'\n',
      nullif(v_first.notes, ''),
      case when v_second.notes is distinct from v_first.notes then nullif(v_second.notes, '') end,
      case when v_first.board is distinct from v_second.board or v_first.shared_price_per_night <> v_second.shared_price_per_night
        then format('Juntado: %s a %s %s %s €; %s a %s %s %s €.',
          to_char(v_first.check_in, 'DD/MM'), to_char(v_first.check_out, 'DD/MM'), v_first.board, v_first.shared_price_per_night,
          to_char(v_second.check_in, 'DD/MM'), to_char(v_second.check_out, 'DD/MM'), v_second.board, v_second.shared_price_per_night)
      end
    ), '')
  where id = p_keep;

  delete from public.pilgrimage_hotel_stays where id = p_drop;
end;
$$;

revoke all on function public.logistics_merge_stays(uuid, uuid) from public, anon, authenticated;
grant execute on function public.logistics_merge_stays(uuid, uuid) to service_role;
