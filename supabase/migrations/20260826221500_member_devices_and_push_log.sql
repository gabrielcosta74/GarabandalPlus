-- Dispositivos dos membros e registo de push enviado.
--
-- Duas coisas que a base de dados nao sabia e que fazem falta para falar com
-- quem nao abre a app:
--
--  1. QUEM ESTA ADORMECIDO. Nao havia sinal nenhum de actividade. Nem
--     `last_login`, nem sessoes, nem nada — a tabela `membros` so sabe de
--     quotas. Nao da para reactivar ninguem sem primeiro saber quem parou.
--
--  2. EM QUE FUSO ESTAO. As notificacoes locais nunca precisaram disto porque o
--     telefone ja sabia. O servidor nao sabe, e mandar "bom dia" as 4 da manha e
--     a forma mais rapida de ser desinstalado. Sao 98 membros no Brasil e 65 em
--     Portugal, quatro horas de diferenca.
--
-- `member_devices` cobre as duas, e cobre a primeira MESMO SEM push: o token e
-- opcional e o batimento de presenca funciona no Expo Go. Os dados de actividade
-- comecam a acumular-se a partir do dia em que isto entra, e nao a partir do dia
-- em que o push ficar pronto.

create table if not exists public.member_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Identidade estavel da instalacao, gerada no telefone e guardada la.
  -- E ela, e nao o token, que identifica o dispositivo: o token do Expo muda
  -- quando a app e reinstalada e e nulo em Expo Go, mas a presenca continua a
  -- interessar-nos nos dois casos.
  install_id text not null,

  -- Nulo ate haver development build. Sem constraint de unicidade de proposito:
  -- um token duplicado faz chegar uma notificacao repetida, o que se resolve com
  -- um Set antes de enviar; uma constraint faz falhar o registo, o que deixa o
  -- membro sem push nenhum. O barulho e preferivel ao silencio.
  expo_push_token text,

  platform text not null default 'unknown'
    check (platform in ('ios', 'android', 'web', 'unknown')),

  -- IANA, ex. "America/Sao_Paulo". Lido do proprio dispositivo.
  timezone text,
  locale text,
  app_version text,

  -- Espelho do interruptor da app. O servidor respeita-o sem ter de perguntar.
  push_enabled boolean not null default true,

  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Um telefone que muda de dono cria uma linha nova em vez de roubar a antiga.
  -- A linha antiga deixa de bater e morre por inactividade, que e mais seguro do
  -- que deixar uma sessao reescrever a linha de outra.
  unique (user_id, install_id)
);

create index if not exists member_devices_user_id_idx
  on public.member_devices(user_id);

-- O indice que serve a pergunta "quem e que nao aparece ha 30 dias".
create index if not exists member_devices_last_seen_idx
  on public.member_devices(last_seen_at desc);

-- So as linhas que conseguem mesmo receber alguma coisa.
create index if not exists member_devices_pushable_idx
  on public.member_devices(last_seen_at desc)
  where expo_push_token is not null and push_enabled;

alter table public.member_devices enable row level security;

-- O membro ve e escreve o seu proprio dispositivo, e mais nada. O service role
-- ignora RLS e e por ai que o cron le todos.
drop policy if exists member_devices_select_own on public.member_devices;
create policy member_devices_select_own on public.member_devices
  for select using (auth.uid() = user_id);

drop policy if exists member_devices_insert_own on public.member_devices;
create policy member_devices_insert_own on public.member_devices
  for insert with check (auth.uid() = user_id);

drop policy if exists member_devices_update_own on public.member_devices;
create policy member_devices_update_own on public.member_devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists member_devices_delete_own on public.member_devices;
create policy member_devices_delete_own on public.member_devices
  for delete using (auth.uid() = user_id);

-- Registo do que ja foi enviado, para o cron nao repetir.
--
-- Mesma forma que `email_notifications`, incluindo a chave unica (type,
-- reference), porque o problema e exactamente o mesmo: um cron que corre outra
-- vez depois de uma falha a meio nao pode reenviar o que ja saiu. Numa
-- notificacao de reactivacao isso seria pior do que nao enviar nada.
create table if not exists public.push_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  type text not null,
  reference text,
  -- Quantos dispositivos aceitaram, para distinguir "nao enviamos" de
  -- "enviamos e o Expo recusou".
  delivered_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (type, reference)
);

create index if not exists push_notifications_user_id_idx
  on public.push_notifications(user_id, created_at desc);

alter table public.push_notifications enable row level security;
-- Sem policies: e uma tabela de servidor. O service role ignora RLS.
