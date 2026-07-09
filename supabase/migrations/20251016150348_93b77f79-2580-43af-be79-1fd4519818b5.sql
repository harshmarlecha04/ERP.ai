-- Security Fix 1: Add server-side business hours validation function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='is_business_hours' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.is_business_hours()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_time_est timestamptz;
    day_of_week int;
    hour_of_day int;
BEGIN
    -- Get current time in Eastern Time
    current_time_est := now() AT TIME ZONE 'America/New_York';
    
    -- Extract day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
    day_of_week := EXTRACT(DOW FROM current_time_est)::int;
    
    -- Extract hour (0-23)
    hour_of_day := EXTRACT(HOUR FROM current_time_est)::int;
    
    -- Check if it's Monday-Friday (1-5) and between 7 AM and 7 PM (7-18)
    RETURN (day_of_week >= 1 AND day_of_week <= 5) 
        AND (hour_of_day >= 7 AND hour_of_day <= 18);
END;
$$;

-- Security Fix 2: Email domain validation trigger
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_email_domain' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_email_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow @pharmvista.com email addresses
    IF NEW.email !~* '^[A-Za-z0-9._%+-]+@pharmvista\.com$' THEN
        RAISE EXCEPTION 'Access denied: Only @pharmvista.com email addresses are allowed to register';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Apply email validation trigger to auth.users
DROP TRIGGER IF EXISTS enforce_email_domain ON auth.users;
DROP TRIGGER IF EXISTS enforce_email_domain ON auth.users;
CREATE TRIGGER enforce_email_domain
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_email_domain();

-- Security Fix 3: Add INSERT policy for user_activity_audit
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can log activity" ON public.user_activity_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can log activity" ON public.user_activity_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can log activity"
ON public.user_activity_audit
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Security Fix 4: Fix security definer views by converting to SECURITY INVOKER
-- Drop and recreate v_packaging_history as SECURITY INVOKER
DROP VIEW IF EXISTS public.v_packaging_history;
CREATE OR REPLACE VIEW public.v_packaging_history 
WITH (security_invoker = true)
AS
SELECT 
    pm.id,
    pm.item_id,
    pm.move_date,
    pm.qty,
    pm.created_at,
    pi.category,
    pi.item_name,
    pm.move_type,
    pm.po,
    pm.vendor,
    pm.location,
    pm.notes
FROM public.packaging_movement pm
LEFT JOIN public.packaging_item pi ON pm.item_id = pi.id;

-- Drop and recreate v_packaging_balances as SECURITY INVOKER
DROP VIEW IF EXISTS public.v_packaging_balances;
CREATE OR REPLACE VIEW public.v_packaging_balances 
WITH (security_invoker = true)
AS
SELECT 
    pi.id AS item_id,
    pi.min_level,
    COALESCE(
        (SELECT SUM(
            CASE 
                WHEN pm.move_type = 'receive' THEN pm.qty
                WHEN pm.move_type = 'use' THEN -pm.qty
                ELSE 0
            END
        )
        FROM public.packaging_movement pm
        WHERE pm.item_id = pi.id), 
        0
    ) AS on_hand,
    pi.created_at,
    pi.updated_at,
    pi.category,
    pi.item_name,
    pi.description,
    pi.sku,
    pi.uom,
    pi.location,
    pi.notes
FROM public.packaging_item pi;

-- Add RLS policies to the views
ALTER VIEW public.v_packaging_history SET (security_invoker = true);
ALTER VIEW public.v_packaging_balances SET (security_invoker = true);

-- Ensure authenticated users can view packaging data
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view packaging history" ON public.packaging_movement; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view packaging history" ON public.packaging_movement; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view packaging history"
ON public.packaging_movement
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view packaging items" ON public.packaging_item; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view packaging items" ON public.packaging_item; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view packaging items"
ON public.packaging_item
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;