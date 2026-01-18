-- Add avatar_url to membros if not exists
ALTER TABLE membros ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage
-- Allow public access to view avatars
CREATE POLICY "Avatar Public Read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Allow authenticated users to upload their own avatar
-- Path convention: avatars/{user_id}/{filename}
CREATE POLICY "Avatar Auth Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own avatar (delete/overwrite logic if needed, but often insert is enough if we use unique names or overwrite)
CREATE POLICY "Avatar Auth Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own avatar
CREATE POLICY "Avatar Auth Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
