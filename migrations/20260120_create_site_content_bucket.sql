-- Create 'site-content' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-content', 'site-content', true)
ON CONFLICT (id) DO NOTHING;

-- Use specific policy names to avoid conflicts with existing generic policies
CREATE POLICY "Public Access site-content"
ON storage.objects FOR SELECT
USING ( bucket_id = 'site-content' );

CREATE POLICY "Authenticated Upload site-content"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'site-content' );

CREATE POLICY "Authenticated Update site-content"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'site-content' );
