-- Migration: Pilgrimage Details
-- Description: Adds logistics (flights, transport, accommodation) and inclusions to pilgrimages.

alter table pilgrimages
add column if not exists flight_departure_time timestamp with time zone,
add column if not exists flight_return_time timestamp with time zone,
add column if not exists transport_type text, -- e.g. 'bus', 'plane'
add column if not exists transport_description text,
add column if not exists transport_image_url text,
add column if not exists accommodation_rating text, -- e.g. '4 Estrelas', 'Superior'
add column if not exists accommodation_description text,
add column if not exists included_items jsonb default '[]'::jsonb, -- Array of strings e.g. ["Voo", "Hotel"]
add column if not exists not_included_items jsonb default '[]'::jsonb; -- Array of strings
