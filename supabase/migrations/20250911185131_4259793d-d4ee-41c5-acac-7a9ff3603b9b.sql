-- Columns that existed on the original DB but are missing from the replayed chain
ALTER TABLE public.user_activity_audit ADD COLUMN IF NOT EXISTS user_email text;
ALTER TABLE public.user_activity_audit ADD COLUMN IF NOT EXISTS user_display_name text;

-- Fix function return type mismatch by casting character varying to text
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_all_user_activity' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_all_user_activity()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_email text,
  user_display_name text,
  activity_type text,
  operation text,
  table_name text,
  record_id text,
  details jsonb,
  ip_address text,
  risk_level text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT
    a.id,
    a.user_id,
    a.user_email::text,
    a.user_display_name::text,
    a.activity_type::text,
    a.operation::text,
    a.table_name::text,
    a.record_id::text,
    (a.details)::jsonb,
    a.ip_address::text,
    a.risk_level::text,
    a.created_at
  FROM public.user_activity_audit a
  ORDER BY a.created_at DESC
$$;