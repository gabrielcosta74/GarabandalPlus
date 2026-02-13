-- Relax constraints for detailed itinerary optional fields
-- This avoids save failures when admin leaves optional fields empty.

alter table if exists public.pilgrimage_itinerary_items
  alter column image_url drop not null;

alter table if exists public.pilgrimage_itinerary_items
  alter column description drop not null;

alter table if exists public.pilgrimage_itinerary_items
  alter column day_number drop not null;

alter table if exists public.pilgrimage_itinerary_items
  alter column display_order drop not null;
