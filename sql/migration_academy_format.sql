-- Migration: Add 'format' column to academy_courses
-- Values: 'course' (Multi-episode) or 'single' (Single Video/Lecture)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'academy_courses' AND column_name = 'format') THEN
        ALTER TABLE academy_courses ADD COLUMN format text DEFAULT 'course';
    END IF;
END $$;

-- Update existing records to be 'course' by default, specific ones to 'single' if logic applies (optional)
-- For now, default is course.
