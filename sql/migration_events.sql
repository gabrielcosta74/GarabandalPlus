-- Create events table
create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  meeting_url text,
  platform text default 'zoom', -- 'zoom', 'meet', 'youtube'
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS
alter table events enable row level security;

-- Policies

-- Public Read: Everyone (authenticated) can see active events
create policy "Allow public read access to active events"
  on events for select
  to authenticated
  using (true);

-- Admin Write: Only specific email can insert/update/delete
create policy "Allow admin full access"
  on events for all
  to authenticated
  using (auth.jwt() ->> 'email' = 'geral@apostoladodegarabandal.com')
  with check (auth.jwt() ->> 'email' = 'geral@apostoladodegarabandal.com');

-- Seed some initial data
insert into events (title, description, start_time, end_time, meeting_url, platform)
values 
  ('Reunião Mensal de Apostolado', 'Encontro mensal para todos os membros do apostolado de Garabandal. Pauta: Planeamento das festas de São Miguel.', now() + interval '2 days', now() + interval '2 days 1 hour', 'https://zoom.us/j/123456789', 'zoom'),
  ('Rosário Online (Terço)', 'Junta-te a nós para rezar o terço em comunidade.', now() + interval '5 days', now() + interval '5 days 45 minutes', 'https://meet.google.com/abc-defg-hij', 'meet'),
  ('Palestra: A Eucaristia', 'Palestra especial com o Padre convidado sobre a importância da Eucaristia nas mensagens.', now() + interval '1 week', now() + interval '1 week 1 hour 30 minutes', 'https://youtube.com/live/xyz', 'youtube');
