-- Add Italian to the content_locale enum so wp_pages, posts and
-- content_translations can hold IT translations of migrated devotional content.
-- ADD VALUE is idempotent here via IF NOT EXISTS and must run outside a txn block.
alter type public.content_locale add value if not exists 'it';
