-- Ensure the get_accessible_suppliers function exists for frontend
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
    WHERE user_has_contact_access
    ORDER BY s.name;
END;
$$;