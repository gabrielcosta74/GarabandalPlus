-- Online training required before an eligible member can request the House.
-- Member and admin access runs through authenticated server routes; the Data API
-- must not expose these contact details or meeting links directly.
create table public.house_training_cohorts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  starts_at timestamptz not null,
  meeting_url text,
  capacity integer not null default 20 check (capacity between 1 and 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.house_training_applications (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros(id),
  cohort_id uuid references public.house_training_cohorts(id) on delete set null,
  code_id uuid unique references public.house_training_codes(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'assigned', 'completed', 'code_issued', 'declined')),
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 160),
  contact_email text not null check (char_length(btrim(contact_email)) between 3 and 254),
  contact_phone text not null check (char_length(btrim(contact_phone)) between 5 and 40),
  availability_notes text,
  admin_notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_training_application_assignment check (
    status not in ('assigned', 'completed', 'code_issued') or cohort_id is not null
  ),
  constraint house_training_application_code check (
    status <> 'code_issued' or code_id is not null
  )
);

create unique index house_training_one_open_application_per_member
  on public.house_training_applications (membro_id)
  where status in ('pending', 'assigned', 'completed');
create index house_training_applications_cohort_status_idx
  on public.house_training_applications (cohort_id, status);
create index house_training_applications_member_created_idx
  on public.house_training_applications (membro_id, created_at desc);
create index house_training_cohorts_starts_at_idx
  on public.house_training_cohorts (starts_at desc);

alter table public.house_training_cohorts enable row level security;
alter table public.house_training_applications enable row level security;
revoke all on public.house_training_cohorts from public, anon, authenticated;
revoke all on public.house_training_applications from public, anon, authenticated;
grant select, insert, update, delete on public.house_training_cohorts to service_role;
grant select, insert, update, delete on public.house_training_applications to service_role;
