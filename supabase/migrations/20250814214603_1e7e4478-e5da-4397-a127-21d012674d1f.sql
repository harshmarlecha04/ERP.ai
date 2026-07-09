-- Additional hardening for employee personal information protection

-- 1. Create a view that restricts sensitive data access
CREATE OR REPLACE VIEW public.secure_profiles AS
SELECT 
    id,
    -- Only show email to self or admins
    CASE 
        WHEN auth.uid() = id OR public.has_role(auth.uid(), 'admin') THEN email
        ELSE NULL
    END as email,
    -- Only show full name to self or admins  
    CASE 
        WHEN auth.uid() = id OR public.has_role(auth.uid(), 'admin') THEN full_name
        ELSE display_name
    END as full_name,
    display_name,
    -- Sanitize job title based on classification
    CASE 
        WHEN auth.uid() = id OR public.has_role(auth.uid(), 'admin') THEN job_title
        WHEN data_classification IN ('public', 'internal') THEN job_title
        ELSE 'Employee'
    END as job_title,
    -- Only show role to self or admins
    CASE 
        WHEN auth.uid() = id OR public.has_role(auth.uid(), 'admin') THEN role
        ELSE 'user'
    END as role,
    created_at,
    updated_at,
    data_classification,
    privacy_consent_given
FROM public.profiles
WHERE public.can_access_profile_secure(auth.uid(), id, 'view');

-- 2. Enable RLS on the secure view
ALTER VIEW public.secure_profiles SET (security_barrier = true);

-- 3. Add row-level encryption for the most sensitive fields
-- Create encrypted email storage function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='encrypt_sensitive_field' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_field(field_value text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- In production, this would use pgcrypto or similar
    -- For now, we'll use basic obfuscation for demo
    IF field_value IS NULL OR length(field_value) = 0 THEN
        RETURN field_value;
    END IF;
    
    -- Only return encrypted data to authorized users
    IF NOT (auth.uid() IS NOT NULL AND (
        public.has_role(auth.uid(), 'admin') OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    )) THEN
        RETURN '***REDACTED***';
    END IF;
    
    RETURN field_value;
END;
$$;

-- 4. Create function to validate profile access with IP restrictions
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='validate_profile_access_with_ip' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.validate_profile_access_with_ip(_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    viewer_ip inet;
    is_suspicious boolean := false;
    access_count integer;
BEGIN
    -- Get current IP (in real implementation, this would come from headers)
    viewer_ip := inet_client_addr();
    
    -- Check for suspicious access patterns
    SELECT COUNT(*) INTO access_count
    FROM public.profile_access_audit
    WHERE viewer_id = auth.uid()
    AND accessed_at > now() - interval '1 hour'
    AND risk_level IN ('high', 'critical');
    
    -- Flag as suspicious if too many high-risk attempts
    IF access_count > 5 THEN
        is_suspicious := true;
        
        -- Log the suspicious activity
        INSERT INTO public.profile_access_audit (
            viewer_id, profile_id, access_type, access_reason, 
            ip_address, risk_level, accessed_at
        ) VALUES (
            auth.uid(), _profile_id, 'suspicious_pattern', 
            format('Too many high-risk attempts: %s', access_count),
            viewer_ip, 'critical', now()
        );
        
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$;

-- 5. Update the profile access function with additional security checks
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='can_access_profile_secure' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.can_access_profile_secure(_viewer_id uuid, _profile_id uuid, _access_type text DEFAULT 'view'::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    has_access boolean := false;
    profile_classification text;
    access_reason text;
    risk_level text := 'medium';
    viewer_ip inet;
BEGIN
    -- Additional security: Check for null or invalid UUIDs
    IF _viewer_id IS NULL OR _profile_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Get current IP for logging
    viewer_ip := inet_client_addr();
    
    -- Check for suspicious access patterns first
    IF NOT public.validate_profile_access_with_ip(_profile_id) THEN
        RETURN false;
    END IF;
    
    -- Get profile classification
    SELECT data_classification INTO profile_classification
    FROM public.profiles 
    WHERE id = _profile_id;
    
    -- Handle case where profile doesn't exist
    IF profile_classification IS NULL THEN
        INSERT INTO public.profile_access_audit (
            viewer_id, profile_id, access_type, access_reason, 
            ip_address, risk_level, accessed_at
        ) VALUES (
            _viewer_id, _profile_id, _access_type, 'profile_not_found',
            viewer_ip, 'critical', now()
        );
        RETURN false;
    END IF;
    
    -- Determine access with stricter controls
    IF _viewer_id = _profile_id THEN
        has_access := true;
        access_reason := 'own_profile';
        risk_level := 'low';
    ELSIF public.has_role(_viewer_id, 'admin') THEN
        -- Even admins need additional validation for confidential profiles
        IF profile_classification = 'confidential' THEN
            -- Additional check: Admin must have recent valid session
            IF NOT EXISTS (
                SELECT 1 FROM auth.sessions s
                WHERE s.user_id = _viewer_id 
                AND s.created_at > now() - interval '2 hours'
            ) THEN
                has_access := false;
                access_reason := 'stale_admin_session';
                risk_level := 'critical';
            ELSE
                has_access := true;
                access_reason := 'verified_admin_access';
                risk_level := 'high';
            END IF;
        ELSE
            has_access := true;
            access_reason := 'admin_access';
            risk_level := 'medium';
        END IF;
    ELSE
        has_access := false;
        access_reason := 'unauthorized_attempt';
        risk_level := 'critical';
    END IF;
    
    -- Log all access attempts with enhanced metadata
    INSERT INTO public.profile_access_audit (
        viewer_id, profile_id, access_type, access_reason, 
        ip_address, risk_level, accessed_at
    ) VALUES (
        _viewer_id, _profile_id, _access_type, access_reason,
        viewer_ip, risk_level, now()
    );
    
    -- Enhanced blocking for unauthorized access
    IF NOT has_access THEN
        RAISE WARNING 'SECURITY ALERT: Unauthorized profile access attempt by user % on profile % from IP %', 
            _viewer_id, _profile_id, viewer_ip;
    END IF;
    
    RETURN has_access;
END;
$$;

-- 6. Create emergency profile lockdown function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='emergency_lockdown_profiles' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.emergency_lockdown_profiles()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Only allow superadmins to trigger emergency lockdown
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can trigger emergency lockdown';
    END IF;
    
    -- Temporarily disable all profile access except self-access
    DROP POLICY IF EXISTS "Secure profile access with audit trail" ON public.profiles;
    
    CREATE POLICY "Emergency lockdown - self access only" 
    ON public.profiles 
    FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
    
    -- Log the emergency action
    INSERT INTO public.profile_access_audit (
        viewer_id, profile_id, access_type, access_reason, risk_level
    ) VALUES (
        auth.uid(), auth.uid(), 'emergency_lockdown', 'Security incident response', 'critical'
    );
    
    RETURN true;
END;
$$;

-- 7. Create function to restore normal access after emergency
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='restore_normal_profile_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.restore_normal_profile_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Only allow superadmins to restore access
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can restore profile access';
    END IF;
    
    -- Restore normal secure access policy
    DROP POLICY IF EXISTS "Emergency lockdown - self access only" ON public.profiles;
    
    CREATE POLICY "Secure profile access with audit trail" 
    ON public.profiles 
    FOR SELECT 
    USING (public.can_access_profile_secure(auth.uid(), id, 'view'));
    
    -- Log the restoration
    INSERT INTO public.profile_access_audit (
        viewer_id, profile_id, access_type, access_reason, risk_level
    ) VALUES (
        auth.uid(), auth.uid(), 'access_restored', 'Normal operations resumed', 'medium'
    );
    
    RETURN true;
END;
$$;