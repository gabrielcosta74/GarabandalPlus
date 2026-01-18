-- Migration: Fix Room Type Constraint
-- Description: Adds 'quadruple' to the allowed room types in the pilgrims table.

-- Drop the existing constraint
ALTER TABLE pilgrims DROP CONSTRAINT IF EXISTS pilgrims_room_type_check;

-- Add the new constraint with 'quadruple' support
ALTER TABLE pilgrims ADD CONSTRAINT pilgrims_room_type_check 
CHECK (room_type IN ('single', 'double', 'triple', 'quadruple'));
