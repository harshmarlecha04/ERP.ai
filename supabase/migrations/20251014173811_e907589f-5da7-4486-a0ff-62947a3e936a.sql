-- Emergency admin assignment for users without roles
-- This migration fixes the admin permission issue

-- First, let's create a function to safely assign admin role
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='emergency_assign_admin' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.emergency_assign_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_exists boolean;
  current_user_id uuid;
BEGIN
  -- Get the current authenticated user
  current_user_id := auth.uid();
  
  -- Check if any admin exists
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  ) INTO admin_exists;
  
  -- If no admin exists and we have a current user, make them admin
  IF NOT admin_exists AND current_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
    VALUES (current_user_id, 'admin', current_user_id, now())
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Emergency admin assigned to user: %', current_user_id;
  END IF;
END;
$$;

-- Execute the emergency admin assignment
SELECT public.emergency_assign_admin();

-- Fix the assign_first_user_as_admin trigger to work correctly
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='assign_first_user_as_admin' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.assign_first_user_as_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only assign admin if no admin exists yet
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
        INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
        VALUES (NEW.id, 'admin', NEW.id, now())
        ON CONFLICT (user_id, role) DO NOTHING;
        
        RAISE NOTICE 'First user assigned admin role: %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created_assign_admin ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_assign_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_first_user_as_admin();

-- Create a secure RPC function for admins to assign roles
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='assign_user_role' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.assign_user_role(
  target_user_id uuid,
  target_role app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only admins can assign roles
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can assign roles'
    );
  END IF;
  
  -- Insert the role
  INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
  VALUES (target_user_id, target_role, auth.uid(), now())
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Role %s assigned to user %s', target_role, target_user_id)
  );
END;
$$;