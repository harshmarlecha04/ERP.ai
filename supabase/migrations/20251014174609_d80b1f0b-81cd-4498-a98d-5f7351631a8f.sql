-- Create a secure RPC function for deleting formulas
-- This bypasses RLS complexity and handles permissions internally

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='delete_formula_secure' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.delete_formula_secure(
  p_formula_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_has_permission boolean;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;
  
  -- Check if user has admin or rd_manager role
  v_has_permission := (
    has_role(v_user_id, 'admin'::app_role) OR 
    has_role(v_user_id, 'rd_manager'::app_role)
  );
  
  IF NOT v_has_permission THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions. Admin or R&D Manager role required.'
    );
  END IF;
  
  -- Perform soft delete
  UPDATE public.formulas
  SET 
    is_deleted = true,
    updated_at = now()
  WHERE id = p_formula_id
  AND NOT is_deleted; -- Don't update if already deleted
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Formula not found or already deleted'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Formula deleted successfully'
  );
END;
$$;