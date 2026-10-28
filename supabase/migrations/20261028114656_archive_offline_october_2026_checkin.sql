begin;

create table if not exists public.pilgrimage_checkin_archives (
  id uuid primary key default gen_random_uuid(),
  source_pilgrimage_id uuid not null references public.pilgrimages(id) on delete restrict,
  archive_key text not null check (length(btrim(archive_key)) > 0),
  title text not null check (length(btrim(title)) > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (source_pilgrimage_id, archive_key)
);

alter table public.pilgrimage_checkin_archives enable row level security;
revoke all on public.pilgrimage_checkin_archives from anon, authenticated;
grant select, insert, update, delete on public.pilgrimage_checkin_archives to service_role;

alter table public.pilgrimage_checkin_submissions
  add column if not exists archive_id uuid references public.pilgrimage_checkin_archives(id) on delete restrict;

create index if not exists pilgrimage_checkin_submissions_archive_submitted_idx
  on public.pilgrimage_checkin_submissions (archive_id, submitted_at, id)
  where archive_id is not null;

-- Preserve the offline October 2026 edition that predates the reused 2027 record.
-- Resolve archive IDs from the inserted rows rather than hardcoding generated IDs.
insert into public.pilgrimage_checkin_archives (source_pilgrimage_id, archive_key, title, notes)
select pilgrimage.id, 'outubro-2026-inscricoes-externas',
  'Peregrinação de outubro de 2026',
  'Inscrições realizadas fora da plataforma. Dados de check-in recebidos em setembro de 2026 e preservados como histórico, separados da edição de 2027.'
from public.pilgrimages as pilgrimage
where pilgrimage.slug = 'peregrinacao-mariana-2027'
  and exists (
    select 1 from public.pilgrimage_checkin_submissions as submission
    where submission.pilgrimage_id = pilgrimage.id
      and submission.submitted_at >= '2026-09-01T00:00:00Z'::timestamptz
      and submission.submitted_at < '2026-10-01T00:00:00Z'::timestamptz
  )
on conflict (source_pilgrimage_id, archive_key) do nothing;

update public.pilgrimage_checkin_submissions as submission
set archive_id = archive.id
from public.pilgrimage_checkin_archives as archive
join public.pilgrimages as pilgrimage on pilgrimage.id = archive.source_pilgrimage_id
where submission.pilgrimage_id = archive.source_pilgrimage_id
  and archive.archive_key = 'outubro-2026-inscricoes-externas'
  and pilgrimage.slug = 'peregrinacao-mariana-2027'
  and submission.archive_id is null
  and submission.submitted_at >= '2026-09-01T00:00:00Z'::timestamptz
  and submission.submitted_at < '2026-10-01T00:00:00Z'::timestamptz;

notify pgrst, 'reload schema';
commit;
