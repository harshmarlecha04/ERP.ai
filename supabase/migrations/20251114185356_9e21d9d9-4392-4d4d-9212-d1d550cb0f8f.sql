-- Drop old version of check_packaging_availability function with integer parameter
DROP FUNCTION IF EXISTS public.check_packaging_availability(uuid, integer, uuid, uuid, uuid);