-- Create academy_progress table to track watch history
CREATE TABLE IF NOT EXISTS academy_progress (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES academy_courses(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES academy_episodes(id) ON DELETE CASCADE,
    progress_seconds INTEGER DEFAULT 0,
    last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed BOOLEAN DEFAULT false,
    PRIMARY KEY (user_id, course_id)
);

-- Create academy_watchlist table for "My List"
CREATE TABLE IF NOT EXISTS academy_watchlist (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES academy_courses(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, course_id)
);

-- RLS Policies
ALTER TABLE academy_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_watchlist ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own progress
CREATE POLICY "Users can manage own progress" ON academy_progress
    FOR ALL USING (auth.uid() = user_id);

-- Users can view and manage their own watchlist
CREATE POLICY "Users can manage own watchlist" ON academy_watchlist
    FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_academy_progress_user ON academy_progress(user_id);
CREATE INDEX idx_academy_progress_last_watched ON academy_progress(last_watched_at DESC);
CREATE INDEX idx_academy_watchlist_user ON academy_watchlist(user_id);
