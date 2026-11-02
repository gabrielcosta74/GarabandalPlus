-- Tracking próprio (first-party) do site: visitantes, sessões e eventos.
-- Não guarda IP nem fingerprint. Sem consentimento analítico o visitante é
-- só a sessão do separador (persistent = false). Escrita apenas pelo servidor
-- (service role, via site_track/site_identify); leitura apenas por admins.

create table if not exists public.site_visitors (
  id text primary key,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  persistent boolean not null default false,
  first_landing_path text,
  first_referrer_host text,
  first_utm_source text,
  first_utm_medium text,
  first_utm_campaign text,
  first_utm_content text,
  country text,
  device text,
  locale text,
  email text,
  lead_id uuid,
  booking_id uuid,
  user_id uuid,
  identified_at timestamptz
);

create table if not exists public.site_sessions (
  id text primary key,
  visitor_id text not null references public.site_visitors(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  landing_path text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  device text,
  browser text,
  os text,
  country text,
  locale text,
  pageviews integer not null default 0,
  events integer not null default 0
);

create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  client_ts timestamptz,
  session_id text not null references public.site_sessions(id) on delete cascade,
  visitor_id text not null references public.site_visitors(id) on delete cascade,
  name text not null,
  path text,
  pilgrimage_id uuid,
  props jsonb not null default '{}'::jsonb
);

create index if not exists site_events_name_created_idx on public.site_events (name, created_at desc);
create index if not exists site_events_session_idx on public.site_events (session_id, created_at);
create index if not exists site_events_visitor_idx on public.site_events (visitor_id, created_at);
create index if not exists site_events_pilgrimage_idx on public.site_events (pilgrimage_id, created_at desc) where pilgrimage_id is not null;
create index if not exists site_sessions_visitor_idx on public.site_sessions (visitor_id, started_at desc);
create index if not exists site_sessions_started_idx on public.site_sessions (started_at desc);
create index if not exists site_visitors_email_idx on public.site_visitors (lower(email)) where email is not null;
create index if not exists site_visitors_lead_idx on public.site_visitors (lead_id) where lead_id is not null;
create index if not exists site_visitors_booking_idx on public.site_visitors (booking_id) where booking_id is not null;

alter table public.site_visitors enable row level security;
alter table public.site_sessions enable row level security;
alter table public.site_events enable row level security;

drop policy if exists site_visitors_admin_read on public.site_visitors;
create policy site_visitors_admin_read on public.site_visitors for select to authenticated using (public.is_admin());
drop policy if exists site_sessions_admin_read on public.site_sessions;
create policy site_sessions_admin_read on public.site_sessions for select to authenticated using (public.is_admin());
drop policy if exists site_events_admin_read on public.site_events;
create policy site_events_admin_read on public.site_events for select to authenticated using (public.is_admin());

-- Ingestão de um lote: cria/atualiza visitante e sessão (first touch fica no
-- primeiro insert) e insere os eventos. Mantém booking_leads.step_reached em
-- dia quando um visitante já ligado a um lead avança no formulário.
create or replace function public.site_track(p_visitor jsonb, p_session jsonb, p_events jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_visitor_id text := p_visitor->>'id';
  v_session_id text := p_session->>'id';
  v_pageviews integer;
  v_lead uuid;
  v_max_step integer;
begin
  if v_visitor_id is null or v_session_id is null then
    return;
  end if;

  insert into site_visitors as v (id, persistent, first_landing_path, first_referrer_host,
    first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, country, device, locale)
  values (v_visitor_id, coalesce((p_visitor->>'persistent')::boolean, false),
    p_session->>'landing_path', p_session->>'referrer_host',
    p_session->>'utm_source', p_session->>'utm_medium', p_session->>'utm_campaign', p_session->>'utm_content',
    p_session->>'country', p_session->>'device', p_session->>'locale')
  on conflict (id) do update set
    last_seen_at = now(),
    persistent = v.persistent or excluded.persistent,
    country = coalesce(excluded.country, v.country),
    device = coalesce(excluded.device, v.device),
    locale = coalesce(excluded.locale, v.locale);

  select count(*) into v_pageviews from jsonb_array_elements(p_events) e where e->>'name' = 'page_view';

  insert into site_sessions as s (id, visitor_id, landing_path, referrer_host, utm_source, utm_medium,
    utm_campaign, utm_content, utm_term, device, browser, os, country, locale, pageviews, events)
  values (v_session_id, v_visitor_id, p_session->>'landing_path', p_session->>'referrer_host',
    p_session->>'utm_source', p_session->>'utm_medium', p_session->>'utm_campaign', p_session->>'utm_content',
    p_session->>'utm_term', p_session->>'device', p_session->>'browser', p_session->>'os',
    p_session->>'country', p_session->>'locale', v_pageviews, jsonb_array_length(p_events))
  on conflict (id) do update set
    last_seen_at = now(),
    pageviews = s.pageviews + excluded.pageviews,
    events = s.events + excluded.events;

  insert into site_events (client_ts, session_id, visitor_id, name, path, pilgrimage_id, props)
  select
    nullif(e->>'ts', '')::timestamptz,
    v_session_id,
    v_visitor_id,
    left(e->>'name', 80),
    left(e->>'path', 300),
    case when (e->>'pilgrimage_id') ~* '^[0-9a-f-]{36}$' then (e->>'pilgrimage_id')::uuid end,
    coalesce(e->'props', '{}'::jsonb)
  from jsonb_array_elements(p_events) e
  where coalesce(e->>'name', '') <> '';

  select max((e->'props'->>'step')::integer) into v_max_step
  from jsonb_array_elements(p_events) e
  where e->>'name' = 'registration_step_viewed' and (e->'props'->>'step') ~ '^\d+$';

  if v_max_step is not null then
    select lead_id into v_lead from site_visitors where id = v_visitor_id;
    if v_lead is not null then
      update booking_leads
         set step_reached = greatest(coalesce(step_reached, 0), v_max_step),
             updated_at = now()
       where id = v_lead and coalesce(step_reached, 0) < v_max_step;
    end if;
  end if;
end;
$$;

-- Liga o visitante a uma pessoa (email/lead/inscrição/conta). Só o servidor
-- chama isto, depois de criar o lead ou a inscrição.
create or replace function public.site_identify(
  p_visitor_id text,
  p_session_id text,
  p_email text default null,
  p_lead_id uuid default null,
  p_booking_id uuid default null,
  p_user_id uuid default null
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_visitor_id is null then
    return;
  end if;

  insert into site_visitors (id) values (p_visitor_id) on conflict (id) do nothing;

  update site_visitors set
    email = coalesce(lower(nullif(trim(p_email), '')), email),
    lead_id = coalesce(p_lead_id, lead_id),
    booking_id = coalesce(p_booking_id, booking_id),
    user_id = coalesce(p_user_id, user_id),
    identified_at = coalesce(identified_at, now()),
    last_seen_at = now()
  where id = p_visitor_id;

  if p_session_id is not null and exists (select 1 from site_sessions where id = p_session_id) then
    insert into site_events (session_id, visitor_id, name, props)
    values (p_session_id, p_visitor_id,
      case when p_booking_id is not null then 'booking_created' else 'lead_identified' end,
      jsonb_strip_nulls(jsonb_build_object('lead_id', p_lead_id, 'booking_id', p_booking_id)));
  end if;
end;
$$;

-- Funil de uma peregrinação (visitantes distintos por etapa). Só admins.
create or replace function public.site_pilgrimage_funnel(p_pilgrimage_id uuid, p_from timestamptz, p_to timestamptz)
returns table (stage_order integer, stage text, visitors bigint)
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
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

-- Origem das sessões que viram a peregrinação, com resultado. Só admins.
create or replace function public.site_pilgrimage_sources(p_pilgrimage_id uuid, p_from timestamptz, p_to timestamptz)
returns table (source text, visitors bigint, cta_clicks bigint, forms bigint, bookings bigint, paid bigint)
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
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

revoke all on function public.site_track(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.site_identify(text, text, text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.site_track(jsonb, jsonb, jsonb) to service_role;
grant execute on function public.site_identify(text, text, text, uuid, uuid, uuid) to service_role;
revoke all on function public.site_pilgrimage_funnel(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.site_pilgrimage_sources(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.site_pilgrimage_funnel(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.site_pilgrimage_sources(uuid, timestamptz, timestamptz) to authenticated;
