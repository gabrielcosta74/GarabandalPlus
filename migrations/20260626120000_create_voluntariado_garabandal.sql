-- Candidaturas de membros para servir em Garabandal como voluntários de apoio ao peregrino.
-- Uma linha por membro (gate forçado na área de membros). status 'candidato' = quer servir;
-- 'nao_interessado' = respondeu que não tem interesse de momento (para não voltar a perguntar).
create table if not exists public.voluntariado_garabandal (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros(id) on delete cascade,
  status text not null default 'candidato' check (status in ('candidato', 'nao_interessado')),
  linguas text[] not null default '{}',
  disponibilidade text,
  esteve_garabandal text,
  condicao_fisica text,
  compromisso_formacao boolean not null default false,
  compromisso_colete boolean not null default false,
  motivacao text,
  admin_estado text not null default 'novo' check (admin_estado in ('novo', 'em_analise', 'aceite', 'recusado')),
  admin_notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (membro_id)
);

create index if not exists idx_voluntariado_status on public.voluntariado_garabandal (status);
create index if not exists idx_voluntariado_created_at on public.voluntariado_garabandal (created_at desc);

alter table public.voluntariado_garabandal enable row level security;

-- Membro vê / cria / atualiza apenas a sua própria candidatura.
drop policy if exists "voluntariado_select_own" on public.voluntariado_garabandal;
create policy "voluntariado_select_own" on public.voluntariado_garabandal
  for select using (auth.uid() = membro_id);

drop policy if exists "voluntariado_insert_own" on public.voluntariado_garabandal;
create policy "voluntariado_insert_own" on public.voluntariado_garabandal
  for insert with check (auth.uid() = membro_id);

drop policy if exists "voluntariado_update_own" on public.voluntariado_garabandal;
create policy "voluntariado_update_own" on public.voluntariado_garabandal
  for update using (auth.uid() = membro_id) with check (auth.uid() = membro_id);

-- Manter updated_at.
create or replace function public.set_voluntariado_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_voluntariado_updated_at on public.voluntariado_garabandal;
create trigger trg_voluntariado_updated_at
  before update on public.voluntariado_garabandal
  for each row execute function public.set_voluntariado_updated_at();
