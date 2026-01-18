-- Create prayer_intentions table
CREATE TABLE IF NOT EXISTS prayer_intentions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    intention_text TEXT NOT NULL,
    candle_type TEXT NOT NULL CHECK (candle_type IN ('free', 'donation')),
    amount DECIMAL(10,2) DEFAULT 0.00,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'presented', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Optional: Tracking if it was exported/printed
    is_printed BOOLEAN DEFAULT FALSE,
    printed_at TIMESTAMP WITH TIME ZONE
);

-- RLS Policies
ALTER TABLE prayer_intentions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own intentions
CREATE POLICY "Users can create intentions" ON prayer_intentions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own intentions
CREATE POLICY "Users can view own intentions" ON prayer_intentions
    FOR SELECT USING (auth.uid() = user_id);

-- Admins (service role or specific admin users) should have full access
-- For simplicity in this app context, we often rely on service_role for admin tasks, 
-- but here's a policy if admins are just authenticated users with a flag.
-- Assuming an 'admins' table or 'is_admin' flag exists, but for now we'll stick to basic user policies.

-- Indexes
CREATE INDEX idx_prayer_intentions_user ON prayer_intentions(user_id);
CREATE INDEX idx_prayer_intentions_status ON prayer_intentions(status);
CREATE INDEX idx_prayer_intentions_created ON prayer_intentions(created_at DESC);
