-- Enhanced employee personal information protection

-- 1. Add data classification to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS data_classification text DEFAULT 'sensitive' CHECK (data_classification IN ('public', 'internal', 'sensitive', 'confidential'));

-- 2. Add privacy consent tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS privacy_consent_given boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS privacy_consent_date timestamp with time zone;

-- 3. Create enhanced profile access logging
CREATE TABLE IF NOT EXISTS public.profile_access_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    access_type text NOT NULL CHECK (access_type IN ('view', 'update', 'admin_view')),
    access_reason text,
    ip_address inet,
    user_agent text,
    session_id text,
    accessed_at timestamp with time zone DEFAULT now(),
    risk_level text DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical'))
);

-- Enable RLS on profile audit table
DO $rls$ BEGIN ALTER TABLE public.profile_access_audit ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- 4. Create secure profile access function with enhanced logging
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
BEGIN
    -- Get profile classification
    SELECT data_classification INTO profile_classification
    FROM public.profiles 
    WHERE id = _profile_id;
    
    -- Determine access reason and risk level
    IF _viewer_id = _profile_id THEN
        has_access := true;
        access_reason := 'own_profile';
        risk_level := 'low';
    ELSIF public.has_role(_viewer_id, 'admin') THEN
        has_access := true;
        access_reason := 'admin_access';
        risk_level := CASE 
            WHEN profile_classification = 'confidential' THEN 'high'
            ELSE 'medium'
        END;
    ELSE
        has_access := false;
        access_reason := 'unauthorized_attempt';
        risk_level := 'critical';
    END IF;
    
    -- Log all access attempts (both successful and failed)
    INSERT INTO public.profile_access_audit (
        viewer_id, profile_id, access_type, access_reason, 
        accessed_at, risk_level
    ) VALUES (
        _viewer_id, _profile_id, _access_type, access_reason,
        now(), risk_level
    );
    
    -- Block unauthorized access attempts with critical risk
    IF NOT has_access AND risk_level = 'critical' THEN
        -- Additional security: Could trigger alerts here
        RAISE WARNING 'Unauthorized profile access attempt by user % on profile %', _viewer_id, _profile_id;
    END IF;
    
    RETURN has_access;
END;
$$;

-- 5. Update profiles table RLS policies with enhanced security
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view own profile, admins can view all profiles" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Strict SELECT policy with logging
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure profile access with audit trail" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure profile access with audit trail" 
ON public.profiles 
FOR SELECT 
USING (public.can_access_profile_secure(auth.uid(), id, 'view')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Strict UPDATE policy with logging  
DO $pol$ BEGIN DROP POLICY IF EXISTS "Secure profile updates with audit trail" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Secure profile updates with audit trail" 
ON public.profiles 
FOR UPDATE 
USING (public.can_access_profile_secure(auth.uid(), id, 'update'))
WITH CHECK (public.can_access_profile_secure(auth.uid(), id, 'update')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Strict INSERT policy (users can only create their own profile)
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can only create their own profile" ON public.profiles; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can only create their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id AND public.can_access_profile_secure(auth.uid(), id, 'create')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 6. RLS policies for profile audit table
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only security admins can view profile audit logs" ON public.profile_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only security admins can view profile audit logs" 
ON public.profile_access_audit 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "System can insert profile audit logs" ON public.profile_access_audit; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "System can insert profile audit logs" 
ON public.profile_access_audit 
FOR INSERT 
WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 7. Create function to get sanitized profile data (without sensitive info)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='get_public_profile' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.get_public_profile(_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    profile_data jsonb;
BEGIN
    -- Only return non-sensitive public information
    SELECT jsonb_build_object(
        'id', id,
        'display_name', display_name,
        'job_title', CASE 
            WHEN data_classification IN ('public', 'internal') THEN job_title
            ELSE 'Employee'
        END
    ) INTO profile_data
    FROM public.profiles 
    WHERE id = _profile_id;
    
    -- Log access to public profile data
    INSERT INTO public.profile_access_audit (
        viewer_id, profile_id, access_type, access_reason, risk_level
    ) VALUES (
        auth.uid(), _profile_id, 'public_view', 'sanitized_access', 'low'
    );
    
    RETURN profile_data;
END;
$$;

-- 8. Create privacy consent management function
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='update_privacy_consent' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.update_privacy_consent(_consent_given boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.profiles 
    SET 
        privacy_consent_given = _consent_given,
        privacy_consent_date = now(),
        updated_at = now()
    WHERE id = auth.uid();
    
    -- Log consent change
    INSERT INTO public.profile_access_audit (
        viewer_id, profile_id, access_type, access_reason, risk_level
    ) VALUES (
        auth.uid(), auth.uid(), 'consent_update', 
        CASE WHEN _consent_given THEN 'consent_granted' ELSE 'consent_revoked' END,
        'medium'
    );
    
    RETURN true;
END;
$$;