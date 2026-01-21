-- Add structured room preference columns to pilgrims table
ALTER TABLE pilgrims ADD COLUMN IF NOT EXISTS bed_preference TEXT; -- 'single', 'double', 'twin'
ALTER TABLE pilgrims ADD COLUMN IF NOT EXISTS sharing_mode TEXT; -- 'random', 'partner'
ALTER TABLE pilgrims ADD COLUMN IF NOT EXISTS roommate_name TEXT;

COMMENT ON COLUMN pilgrims.bed_preference IS 'Preferencia de cama: single, double, twin';
COMMENT ON COLUMN pilgrims.sharing_mode IS 'Modo de partilha: random (aleatorio) ou partner (com pessoa especifica)';
COMMENT ON COLUMN pilgrims.roommate_name IS 'Nome da pessoa com quem quer partilhar quarto';
