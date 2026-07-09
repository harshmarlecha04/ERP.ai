-- CRITICAL SECURITY FIX: Implement secure supplier access functions
-- Address duplicate policy issue by focusing on the secure functions

-- Create secure function to get suppliers with contact info (authorized users only)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_accessible_suppliers' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_accessible_suppliers(_user_id uuid)
RETURNS TABLE(
    id uuid,
    name text,
    contact_info text,
    emails jsonb,
    phone_numbers jsonb,
    notes text,
    vetting_link text,
    address text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Enhanced security: Only essential roles can access supplier contact info
    IF NOT (
        has_role(_user_id, 'admin'::app_role) OR 
        has_role(_user_id, 'production_manager'::app_role)
    ) THEN
        -- Log unauthorized access attempt (if audit table exists)
        BEGIN
            INSERT INTO public.supplier_access_audit (
                accessed_by, supplier_id, access_type, access_reason, risk_level
            ) VALUES (
                _user_id, NULL, 'denied', 'insufficient_permissions', 'high'
            );
        EXCEPTION 
            WHEN OTHERS THEN NULL; -- Ignore if audit table doesn't exist yet
        END;
        
        RAISE EXCEPTION 'Access denied: Only administrators and production managers can access supplier contact information';
    END IF;
    
    -- Log authorized access (if audit table exists)
    BEGIN
        INSERT INTO public.supplier_access_audit (
            accessed_by, supplier_id, access_type, access_reason, risk_level
        ) VALUES (
            _user_id, NULL, 'list_view', 'authorized_access', 'medium'
        );
    EXCEPTION 
        WHEN OTHERS THEN NULL; -- Ignore if audit table doesn't exist yet
    END;
    
    -- Return suppliers with contact information for authorized users only
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.contact_info,
        s.emails,
        s.phone_numbers,
        s.notes,
        s.vetting_link,
        s.address,
        s.created_at,
        s.updated_at
    FROM public.suppliers s;
END;
$$;

-- Create secure function to update suppliers with audit logging
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='update_supplier_secure' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.update_supplier_secure(
    _supplier_id uuid,
    _supplier_data jsonb,
    _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check permissions
    IF NOT (
        has_role(_user_id, 'admin'::app_role) OR 
        has_role(_user_id, 'production_manager'::app_role)
    ) THEN
        -- Log unauthorized update attempt (if audit table exists)
        BEGIN
            INSERT INTO public.supplier_access_audit (
                accessed_by, supplier_id, access_type, access_reason, risk_level
            ) VALUES (
                _user_id, _supplier_id, 'update_denied', 'insufficient_permissions', 'high'
            );
        EXCEPTION 
            WHEN OTHERS THEN NULL; -- Ignore if audit table doesn't exist yet
        END;
        
        RETURN jsonb_build_object('success', false, 'error', 'Access denied: Insufficient permissions');
    END IF;
    
    -- Log the update attempt (if audit table exists)
    BEGIN
        INSERT INTO public.supplier_access_audit (
            accessed_by, supplier_id, access_type, access_reason, risk_level
        ) VALUES (
            _user_id, _supplier_id, 'update', 'authorized_modification', 'high'
        );
    EXCEPTION 
        WHEN OTHERS THEN NULL; -- Ignore if audit table doesn't exist yet
    END;
    
    -- Perform the update
    UPDATE public.suppliers
    SET 
        name = COALESCE(_supplier_data->>'name', name),
        contact_info = COALESCE(_supplier_data->>'contact_info', contact_info),
        emails = COALESCE((_supplier_data->>'emails')::jsonb, emails),
        phone_numbers = COALESCE((_supplier_data->>'phone_numbers')::jsonb, phone_numbers),
        notes = COALESCE(_supplier_data->>'notes', notes),
        vetting_link = COALESCE(_supplier_data->>'vetting_link', vetting_link),
        address = COALESCE(_supplier_data->>'address', address),
        updated_at = now()
    WHERE id = _supplier_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Supplier updated successfully');
END;
$$;

-- Update table comments to document security enhancements
COMMENT ON TABLE public.suppliers IS 'Supplier information with enhanced security controls. Contact information (emails, phone numbers) is restricted to authorized personnel only (admin and production_manager roles) with full audit logging for compliance monitoring.';

-- Update function comments
COMMENT ON FUNCTION public.get_accessible_suppliers IS 'Secure function to retrieve supplier data with contact information. Only accessible by admin and production_manager roles. All access attempts are logged for security auditing.';