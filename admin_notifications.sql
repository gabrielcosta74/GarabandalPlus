-- Tabela para notificações de admin
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL, -- 'order', 'member', 'booking', 'donation'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ativar RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Allow read access for authenticated users"
ON admin_notifications FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow update access for authenticated users"
ON admin_notifications FOR UPDATE
TO authenticated
USING (true);
