-- Tracking próprio, parte 2: inteligência por cima dos eventos.
-- - As funções de leitura passam a SECURITY DEFINER: a tabela bookings não
--   tem leitura para admins via RLS, e sem isto o funil mostrava sempre 0
--   inscrições/pagamentos. Cada função verifica site_can_read() primeiro.
-- - site_pilgrimage_people: uma linha por pessoa (email) com os sinais de
--   interesse usados na pontuação (src/lib/site-intent-score.ts).
-- - site_person_bookings: inscrições de uma pessoa, para o perfil.
-- - site_weekly_reports: relatórios semanais gerados pelo agente de análise.

create or replace function public.site_can_read()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or coalesce(auth.role(), '') = 'service_role';
$$;

create or replace function public.site_pilgrimage_funnel(p_pilgrimage_id uuid, p_from timestamptz, p_to timestamptz)
returns table (stage_order integer, stage text, visitors bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.site_can_read() then
    raise exception 'forbidden';
  end if;

  return query
  with ev as (
    select e.visitor_id, e.name, e.props
    from site_events e
    where e.pilgrimage_id = p_pilgrimage_id
      and e.created_at >= p_from and e.created_at < p_to
  ),
  booked as (
    select distinct v.id as visitor_id, b.paid_amount
    from site_visitors v
    join bookings b on b.id = v.booking_id
    where b.pilgrimage_id = p_pilgrimage_id
      and b.created_at >= p_from and b.created_at < p_to
  )
  select 1, 'Viu a página', count(distinct visitor_id) from ev where name = 'pilgrimage_viewed'
  union all select 2, 'Chegou ao preço', count(distinct visitor_id) from ev where name = 'section_view' and props->>'section' in ('pricing', 'trip_details')
  union all select 3, 'Clicou em inscrever', count(distinct visitor_id) from ev where name = 'pilgrimage_cta_clicked'
  union all select 4, 'Abriu o formulário', count(distinct visitor_id) from ev where name = 'registration_step_viewed' and props->>'step_name' = 'identificacao'
  union all select 5, 'Deu o email', count(distinct visitor_id) from ev where name = 'registration_step_viewed' and props->>'step_name' = 'dados'
  union all select 6, 'Preencheu os dados', count(distinct visitor_id) from ev where name = 'registration_step_viewed' and props->>'step_name' in ('quartos', 'voos')
  union all select 7, 'Chegou ao pagamento', count(distinct visitor_id) from ev where name = 'registration_step_viewed' and props->>'step_name' = 'pagamento'
  union all select 8, 'Confirmou a inscrição', count(distinct visitor_id) from ev where name = 'registration_submitted'
  union all select 9, 'Inscrição criada', count(*) from booked
  union all select 10, 'Pagou', count(*) from booked where coalesce(paid_amount, 0) > 0
  order by 1;
end;
$$;

create or replace function public.site_pilgrimage_sources(p_pilgrimage_id uuid, p_from timestamptz, p_to timestamptz)
returns table (source text, visitors bigint, cta_clicks bigint, forms bigint, bookings bigint, paid bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.site_can_read() then
    raise exception 'forbidden';
  end if;

  return query
  with sess as (
    select distinct on (e.visitor_id) e.visitor_id,
      coalesce(nullif(s.utm_source, ''), nullif(s.referrer_host, ''), 'direto') as src
    from site_events e
    join site_sessions s on s.id = e.session_id
    where e.pilgrimage_id = p_pilgrimage_id and e.name = 'pilgrimage_viewed'
      and e.created_at >= p_from and e.created_at < p_to
    order by e.visitor_id, e.created_at
  ),
  acts as (
    select e.visitor_id,
      bool_or(e.name = 'pilgrimage_cta_clicked') as cta,
      bool_or(e.name = 'registration_step_viewed') as form
    from site_events e
    where e.pilgrimage_id = p_pilgrimage_id and e.created_at >= p_from and e.created_at < p_to
    group by e.visitor_id
  )
  select sess.src,
    count(*),
    count(*) filter (where acts.cta),
    count(*) filter (where acts.form),
    count(b.id),
    count(b.id) filter (where coalesce(b.paid_amount, 0) > 0)
  from sess
  left join acts on acts.visitor_id = sess.visitor_id
  left join site_visitors v on v.id = sess.visitor_id
  left join bookings b on b.id = v.booking_id and b.pilgrimage_id = p_pilgrimage_id
  group by sess.src
  order by 2 desc;
end;
$$;

create or replace function public.site_pilgrimage_people(p_pilgrimage_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  email text,
  visitor_ids text[],
  first_source text,
  first_campaign text,
  first_seen timestamptz,
  last_seen timestamptz,
  sessions bigint,
  page_views bigint,
  active_seconds bigint,
  read_itinerary boolean,
  read_pricing boolean,
  info_opens bigint,
  cta_clicks bigint,
  max_step text,
  validation_errors bigint,
  chat_messages bigint,
  chat_session_ids text[],
  whatsapp_clicks bigint,
  lead_name text,
  lead_phone text,
  booking_id uuid,
  booking_status text,
  paid_amount numeric,
  total_amount numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.site_can_read() then
    raise exception 'forbidden';
  end if;

  return query
  with candidates as (
    select v.*
    from site_visitors v
    where v.email is not null
      and (
        exists (select 1 from site_events e where e.visitor_id = v.id and e.pilgrimage_id = p_pilgrimage_id
                and e.created_at >= p_from and e.created_at < p_to)
        or exists (select 1 from booking_leads l where l.id = v.lead_id and l.pilgrimage_id = p_pilgrimage_id
                   and l.updated_at >= p_from)
        or exists (select 1 from bookings b where b.id = v.booking_id and b.pilgrimage_id = p_pilgrimage_id
                   and b.created_at >= p_from)
      )
  ),
  people as (
    select lower(c.email) as email,
      array_agg(c.id) as ids,
      array_agg(c.lead_id) filter (where c.lead_id is not null) as lead_ids,
      array_agg(c.booking_id) filter (where c.booking_id is not null) as booking_ids,
      array_agg(c.user_id) filter (where c.user_id is not null) as user_ids,
      min(c.created_at) as first_seen,
      max(c.last_seen_at) as last_seen
    from candidates c
    group by lower(c.email)
  )
  select
    p.email,
    p.ids,
    fs.src,
    fs.campaign,
    p.first_seen,
    p.last_seen,
    (select count(*) from site_sessions s where s.visitor_id = any(p.ids)),
    agg.page_views,
    agg.active_seconds,
    agg.read_itinerary,
    agg.read_pricing,
    agg.info_opens,
    agg.cta_clicks,
    agg.max_step,
    agg.validation_errors,
    agg.chat_messages,
    agg.chat_session_ids,
    agg.whatsapp_clicks,
    ld.name,
    ld.phone,
    bk.id,
    bk.status::text,
    bk.paid_amount::numeric,
    bk.total_amount::numeric
  from people p
  left join lateral (
    select coalesce(nullif(s.utm_source, ''), nullif(s.referrer_host, ''), 'direto') as src, s.utm_campaign as campaign
    from site_sessions s
    where s.visitor_id = any(p.ids)
    order by s.started_at
    limit 1
  ) fs on true
  left join lateral (
    select
      count(*) filter (where e.name = 'page_view') as page_views,
      coalesce(sum((e.props->>'active_seconds')::numeric) filter (where e.name = 'page_leave'), 0)::bigint as active_seconds,
      bool_or(e.name = 'section_view' and e.props->>'section' = 'itinerary') as read_itinerary,
      bool_or(e.name = 'section_view' and e.props->>'section' in ('pricing', 'trip_details')) as read_pricing,
      count(*) filter (where e.name = 'pilgrimage_info_opened') as info_opens,
      count(*) filter (where e.name = 'pilgrimage_cta_clicked') as cta_clicks,
      (array_agg(e.props->>'step_name' order by array_position(array['identificacao','dados','quartos','voos','pagamento'], e.props->>'step_name') desc nulls last)
        filter (where e.name = 'registration_step_viewed' and e.pilgrimage_id = p_pilgrimage_id))[1] as max_step,
      count(*) filter (where e.name = 'registration_validation_failed') as validation_errors,
      count(*) filter (where e.name = 'chat_message_sent') as chat_messages,
      array_remove(array_agg(distinct e.props->>'chat_session_id'), null) as chat_session_ids,
      count(*) filter (where e.name = 'whatsapp_contact_clicked') as whatsapp_clicks
    from site_events e
    where e.visitor_id = any(p.ids) and e.created_at < p_to
  ) agg on true
  left join lateral (
    select l.name, l.phone
    from booking_leads l
    where l.id = any(coalesce(p.lead_ids, '{}')) and l.pilgrimage_id = p_pilgrimage_id
    order by l.updated_at desc nulls last
    limit 1
  ) ld on true
  left join lateral (
    select b.id, b.status, b.paid_amount, b.total_amount
    from bookings b
    where b.pilgrimage_id = p_pilgrimage_id
      and (b.id = any(coalesce(p.booking_ids, '{}')) or b.user_id = any(coalesce(p.user_ids, '{}')))
    order by b.created_at desc
    limit 1
  ) bk on true
  order by p.last_seen desc;
end;
$$;

create or replace function public.site_person_bookings(p_email text)
returns table (id uuid, status text, paid_amount numeric, total_amount numeric, created_at timestamptz, pilgrimage_title text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.site_can_read() then
    raise exception 'forbidden';
  end if;

  return query
  select b.id, b.status::text, b.paid_amount::numeric, b.total_amount::numeric, b.created_at, pg.title
  from bookings b
  left join pilgrimages pg on pg.id = b.pilgrimage_id
  where b.id in (select v.booking_id from site_visitors v where lower(v.email) = lower(p_email) and v.booking_id is not null)
     or b.user_id in (select v.user_id from site_visitors v where lower(v.email) = lower(p_email) and v.user_id is not null)
  order by b.created_at desc;
end;
$$;

create table if not exists public.site_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  metrics jsonb not null default '{}'::jsonb,
  analysis text,
  model text,
  emailed_to text,
  trigger text not null default 'cron'
);

create index if not exists site_weekly_reports_created_idx on public.site_weekly_reports (created_at desc);

alter table public.site_weekly_reports enable row level security;
drop policy if exists site_weekly_reports_admin_read on public.site_weekly_reports;
create policy site_weekly_reports_admin_read on public.site_weekly_reports for select to authenticated using (public.is_admin());

revoke all on function public.site_can_read() from public, anon;
revoke all on function public.site_pilgrimage_people(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.site_person_bookings(text) from public, anon;
grant execute on function public.site_can_read() to authenticated, service_role;
grant execute on function public.site_pilgrimage_people(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.site_person_bookings(text) to authenticated, service_role;
grant execute on function public.site_pilgrimage_funnel(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.site_pilgrimage_sources(uuid, timestamptz, timestamptz) to service_role;
