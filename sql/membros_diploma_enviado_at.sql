alter table public.membros
  add column if not exists diploma_enviado_at timestamptz null;
