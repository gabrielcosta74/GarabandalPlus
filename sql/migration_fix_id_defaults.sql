-- Fix ID Defaults
-- Ensures that the 'id' column auto-generates a UUID if not provided.
-- This resolves the "null value in column id violates not-null constraint" error.

alter table public.pilgrimage_stages 
  alter column id set default gen_random_uuid();

alter table public.pilgrimage_itinerary_items 
  alter column id set default gen_random_uuid();
