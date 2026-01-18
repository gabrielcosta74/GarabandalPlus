create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_email text null,
  member_id uuid null,
  action text not null,
  details jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_member_idx
  on public.admin_audit_logs(member_id);

create index if not exists admin_audit_logs_action_idx
  on public.admin_audit_logs(action);
