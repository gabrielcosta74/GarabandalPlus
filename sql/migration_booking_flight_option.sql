-- Migration: Booking Flight Option
-- Description: Adds user preference for flight booking (Agency vs Self).

alter table bookings
add column if not exists flight_preference text default 'none' check (flight_preference in ('agency', 'self', 'none'));
