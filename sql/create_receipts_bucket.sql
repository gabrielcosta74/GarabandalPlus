-- SQL to create the 'receipts' storage bucket and set policies
-- Run this in the Supabase SQL Editor

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public access to read files (since it's a public bucket)
-- This ensures the receipt_url links work for everyone with the link
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'receipts' );

-- 3. Allow authenticated users to upload files
-- While we use the service role key in the API, this is a good safety measure
CREATE POLICY "Allow Authenticated Uploads"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'receipts' AND auth.role() = 'authenticated' );

-- 4. Allow authenticated users to delete/update their own files (optional)
CREATE POLICY "Allow Authenticated Updates"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'receipts' AND auth.role() = 'authenticated' );
