-- Add is_featured column to academy_courses table
ALTER TABLE academy_courses 
ADD COLUMN is_featured BOOLEAN DEFAULT false;

-- Create an index for faster querying of featured items
CREATE INDEX idx_academy_courses_featured ON academy_courses(is_featured);

-- Comment
COMMENT ON COLUMN academy_courses.is_featured IS 'If true, this course/video will be displayed in the Hero Banner of the member area.';
