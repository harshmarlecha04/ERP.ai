-- Drop the old version of check_packaging_availability function
-- This version has incorrect filtering logic and conflicts with the new one
DROP FUNCTION IF EXISTS check_packaging_availability(uuid, integer, integer);