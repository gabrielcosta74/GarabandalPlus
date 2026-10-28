-- Gestão central de notificações push da app Garabandal+.
--
-- `push_campaigns` guarda os broadcasts criados no admin, incluindo os que
-- ficam agendados para o cron. `push_automation_settings` tira a reativação de
-- 30 dias do código rígido sem alterar o comportamento atual por defeito.

create table if not exists public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target text not null default 'all_push_enabled'
    check (target in ('all_push_enabled')),
  title_pt text not null,
  body_pt text not null,
  title_en text,
  body_en text,
  destination_url text not null default '/',
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'partial', 'failed', 'cancelled')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipient_count integer not null default 0,
  device_count integer not null default 0,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_campaigns_status_schedule_idx
  on public.push_campaigns(status, scheduled_for);

create index if not exists push_campaigns_created_at_idx
  on public.push_campaigns(created_at desc);

alter table public.push_campaigns enable row level security;
-- Sem policies: apenas as rotas de servidor com service role têm acesso.

create table if not exists public.push_automation_settings (
  key text primary key,
  name text not null,
  description text not null,
  enabled boolean not null default true,
  send_hour_local integer not null default 10
    check (send_hour_local between 0 and 23),
  inactivity_days integer not null default 30
    check (inactivity_days between 1 and 365),
  cooldown_days integer not null default 60
    check (cooldown_days between 1 and 730),
  title_pt text not null,
  body_pt text not null,
  title_en text not null,
  body_en text not null,
  destination_url text not null default '/',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.push_automation_settings enable row level security;
-- Sem policies: apenas as rotas de servidor com service role têm acesso.

insert into public.push_automation_settings (
  key,
  name,
  description,
  enabled,
  send_hour_local,
  inactivity_days,
  cooldown_days,
  title_pt,
  body_pt,
  title_en,
  body_en,
  destination_url
) values (
  'reactivation_30d',
  'Reativação de membros inativos',
  'Convida a voltar quem não abre a app há algum tempo, respeitando o fuso horário e um intervalo mínimo entre envios.',
  true,
  10,
  30,
  60,
  'Um momento de oração hoje 🕊️',
  'A novena e as orações continuam aqui, sempre que quiser voltar.',
  'A moment of prayer today 🕊️',
  'The novena and the prayers are here whenever you want to return.',
  '/'
)
on conflict (key) do nothing;
