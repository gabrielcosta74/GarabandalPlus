-- ============================================================
-- SECURITY HARDENING: Storage Bucket Policies
-- Migration: security_hardening_storage
-- Description: Fixes critical storage security vulnerabilities
-- ============================================================

-- ============================================================
-- PART 1: CRITICAL - Lock Down Payment Proofs Bucket
-- Current Issue: "Anyone can do anything in payment-proofs"
-- ============================================================

-- Remove DANGEROUS open access policy
DROP POLICY IF EXISTS "Anyone can do anything in payment-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload payment proofs" ON storage.objects;

-- User-scoped uploads only (path: payment-proofs/{user_id}/...)
CREATE POLICY "Users upload own payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only view their own proofs + admins can view all
CREATE POLICY "Users view own payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR auth.jwt()->>'email' LIKE '%@apostoladodegarabandal.com'
    )
  );

-- Users can update their own proofs
CREATE POLICY "Users update own payment proofs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'payment-proofs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own proofs
CREATE POLICY "Users delete own payment proofs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'payment-proofs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- PART 2: CRITICAL - Lock Down Receipts Bucket
-- Current Issue: Authenticated users can upload/update anywhere
-- ============================================================

-- Remove overly broad policies
DROP POLICY IF EXISTS "Allow Authenticated Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Updates" ON storage.objects;

-- User-scoped receipts (path: receipts/{user_id}/{booking_id}/file.jpg)
CREATE POLICY "Users upload own receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own receipts
CREATE POLICY "Users update own receipts"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own receipts
CREATE POLICY "Users delete own receipts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Keep public read access (existing "Public Access" policy is fine)

-- ============================================================
-- PART 3: Lock Down Site Content Bucket
-- Current Issue: Any authenticated user can write
-- ============================================================

-- Remove broad authenticated access
DROP POLICY IF EXISTS "Authenticated can upload site-content" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update site-content" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete site-content" ON storage.objects;

-- Admin-only write (using email domain check)
-- TODO: Replace with proper RBAC in future
CREATE POLICY "Admins only upload site-content"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'site-content'
    AND auth.jwt()->>'email' LIKE '%@apostoladodegarabandal.com'
  );

CREATE POLICY "Admins only update site-content"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'site-content'
    AND auth.jwt()->>'email' LIKE '%@apostoladodegarabandal.com'
  );

CREATE POLICY "Admins only delete site-content"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'site-content'
    AND auth.jwt()->>'email' LIKE '%@apostoladodegarabandal.com'
  );

-- Keep public read (existing "Public Access site-content" policy)

-- ============================================================
-- PART 4: Lock Down Store Products Bucket
-- Current Issue: Authenticated users can write/delete
-- ============================================================

-- Remove overly permissive policies
DROP POLICY IF EXISTS "Authenticated upload store products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update store products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete store products" ON storage.objects;

-- Admin-only write
CREATE POLICY "Admins only upload store products"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'store-products'
    AND auth.jwt()->>'email' LIKE '%@apostoladodegarabandal.com'
  );

CREATE POLICY "Admins only update store products"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'store-products'
    AND auth.jwt()->>'email' LIKE '%@apostoladodegarabandal.com'
  );

CREATE POLICY "Admins only delete store products"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'store-products'
    AND auth.jwt()->>'email' LIKE '%@apostoladodegarabandal.com'
  );

-- Keep public read (existing "Public read store products" policy)

-- ============================================================
-- PART 5: Secure Other Critical Buckets
-- ============================================================

-- Ensure avatars bucket is properly scoped (keep existing policies, they're good)
-- Ensure prayer-assets and novena-assets stay public read + admin write

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- List all storage policies by bucket
SELECT 
  b.id as bucket_id,
  b.public,
  p.policyname,
  p.cmd,
  LEFT(p.qual::text, 80) as using_clause,
  LEFT(p.with_check::text, 80) as with_check_clause
FROM storage.buckets b
LEFT JOIN pg_policies p ON p.schemaname = 'storage' AND p.tablename = 'objects'
WHERE b.id IN ('payment-proofs', 'receipts', 'site-content', 'store-products')
ORDER BY b.id, p.policyname;

-- Check for dangerous open policies
SELECT policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND (
    qual::text LIKE '%true%' 
    OR with_check::text LIKE '%true%'
    OR policyname ILIKE '%anyone%'
    OR policyname ILIKE '%all%'
  )
ORDER BY policyname;
