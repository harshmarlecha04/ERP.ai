-- Original migration attempted to add RLS policies to the secure_profiles VIEW,
-- which Postgres does not support (policies apply to tables only).
-- The underlying profiles table already carries the RLS policies.
DO $v$ BEGIN
  ALTER VIEW public.secure_profiles SET (security_barrier = true);
EXCEPTION WHEN undefined_table THEN NULL; END $v$;
