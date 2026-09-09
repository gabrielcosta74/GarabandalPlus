-- Formulários públicos de dados para check-in de hotel.
-- Os visitantes submetem através de uma API do servidor. As tabelas não ficam
-- acessíveis diretamente aos papéis anon/authenticated do Supabase.

alter table public.pilgrimages
add column if not exists checkin_form_enabled boolean not null default false;

create table if not exists public.pilgrimage_checkin_submissions (
  id bigint generated always as identity primary key,
  pilgrimage_id uuid not null references public.pilgrimages(id) on delete cascade,
  full_name text not null,
  nationality text not null,
  document_type text not null,
  document_number text not null,
  document_issued_on date not null,
  document_expires_on date not null,
  birth_date date not null,
  full_address text not null,
  postal_code text not null,
  city text not null,
  phone text not null,
  email text not null,
  privacy_consent_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  constraint pilgrimage_checkin_document_type_check
    check (document_type in ('citizen_card', 'passport')),
  constraint pilgrimage_checkin_document_dates_check
    check (document_issued_on <= document_expires_on),
  constraint pilgrimage_checkin_required_text_check
    check (
      char_length(btrim(full_name)) > 0
      and char_length(btrim(nationality)) > 0
      and char_length(btrim(document_number)) > 0
      and char_length(btrim(full_address)) > 0
      and char_length(btrim(postal_code)) > 0
      and char_length(btrim(city)) > 0
      and char_length(btrim(phone)) > 0
      and char_length(btrim(email)) > 0
    )
);

create index if not exists pilgrimage_checkin_submissions_pilgrimage_submitted_idx
  on public.pilgrimage_checkin_submissions (pilgrimage_id, submitted_at desc);

alter table public.pilgrimage_checkin_submissions enable row level security;

revoke all on table public.pilgrimage_checkin_submissions from anon, authenticated;
revoke all on sequence public.pilgrimage_checkin_submissions_id_seq from anon, authenticated;
grant select, insert, update, delete on table public.pilgrimage_checkin_submissions to service_role;
grant usage, select on sequence public.pilgrimage_checkin_submissions_id_seq to service_role;

-- Ativa apenas os dois formulários pedidos.
update public.pilgrimages
set checkin_form_enabled = true
where slug in (
  'peregrinacao-iberica-2026',
  'peregrinacao-iberico-novembro-2026'
);

notify pgrst, 'reload schema';
