-- Gestores de Oração: whitelist de emails autorizados a aceder ao portal externo
CREATE TABLE IF NOT EXISTS prayer_managers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS activado: só o service role pode ler/escrever (o portal acede via API server-side)
ALTER TABLE prayer_managers ENABLE ROW LEVEL SECURITY;

-- Nenhuma política de acesso público — tudo passa pelo service role
CREATE POLICY "sem acesso publico" ON prayer_managers USING (false);
