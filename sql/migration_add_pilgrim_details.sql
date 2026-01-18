-- Migration: Add Missing Pilgrim Details
-- Description: Adds address, city, country, postal_code, and sex columns to the pilgrims table.
-- Fixes error: "Could not find the 'address' column of 'pilgrims' in the schema cache"

ALTER TABLE pilgrims
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS sex text;

-- Force schema cache reload (usually happens automatically on DDL, but ensuring)
NOTIFY pgrst, 'reload config';
