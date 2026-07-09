-- Fix critical security vulnerability: Restrict supplier contact information access
-- Drop the overly permissive RLS policy
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create secure RLS policies for suppliers based on roles and business need

-- Policy for SELECT: Only allow access to users with procurement/management roles
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure supplier access for viewing" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure supplier access for viewing" 
ON public.suppliers 
FOR SELECT
TO authenticated
USING (
  -- Allow access to admins and managers who need supplier information for business operations
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role) OR
  has_role(auth.uid(), 'hr_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Policy for INSERT: Only admins and production managers can create suppliers
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure supplier creation" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure supplier creation" 
ON public.suppliers 
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Policy for UPDATE: Only admins and production managers can update supplier information
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure supplier updates" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure supplier updates" 
ON public.suppliers 
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Policy for DELETE: Only admins can delete suppliers
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure supplier deletion" ON public.suppliers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure supplier deletion" 
ON public.suppliers 
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create audit logging function for supplier access
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='log_supplier_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.log_supplier_access(_user_id uuid, _supplier_id uuid, _access_type text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Log supplier access for security monitoring
    INSERT INTO public.profile_access_audit (
        viewer_id,
        profile_id,
        access_type,
        access_reason,
        accessed_at,
        risk_level
    ) VALUES (
        _user_id,
        _supplier_id,
        _access_type,
        'supplier_data_access',
        now(),
        CASE 
            WHEN _access_type IN ('bulk_export', 'contact_list_view') THEN 'high'
            ELSE 'medium'
        END
    );
END;
$$;

-- Create a secure function to get accessible suppliers for users
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_accessible_suppliers' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_accessible_suppliers(_user_id uuid)
RETURNS TABLE(
    id uuid,
    name text,
    contact_info text,
    address text,
    notes text,
    vetting_link text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    -- Only return contact details for authorized roles
    emails jsonb,
    phone_numbers jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    user_has_contact_access boolean := false;
BEGIN
    -- Check if user has permission to access contact information
    user_has_contact_access := (
        has_role(_user_id, 'admin'::app_role) OR 
        has_role(_user_id, 'production_manager'::app_role) OR
        has_role(_user_id, 'hr_manager'::app_role)
    );
    
    -- Return suppliers with conditional contact information
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.contact_info,
        s.address,
        s.notes,
        s.vetting_link,
        s.created_at,
        s.updated_at,
        -- Only return sensitive contact data if user has proper role
        CASE WHEN user_has_contact_access THEN s.emails ELSE '[]'::jsonb END as emails,
        CASE WHEN user_has_contact_access THEN s.phone_numbers ELSE '[]'::jsonb END as phone_numbers
    FROM public.suppliers s
    WHERE user_has_contact_access OR (
        -- Non-privileged users can only see basic supplier info without contact details
        s.id IN (
            SELECT DISTINCT rm.supplier::uuid 
            FROM public.raw_materials rm 
            WHERE rm.supplier IS NOT NULL
        )
    )
    ORDER BY s.name;
END;
$$;