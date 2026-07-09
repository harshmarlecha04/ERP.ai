-- Enhanced formula security for trade secret protection

-- 1. Add formula classification levels
ALTER TABLE public.formulas 
ADD COLUMN IF NOT EXISTS classification_level text DEFAULT 'standard' CHECK (classification_level IN ('public', 'internal', 'confidential', 'trade_secret'));

-- 2. Add approval workflow for trade secret access
CREATE TABLE IF NOT EXISTS public.formula_access_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    formula_id uuid NOT NULL,
    access_type text NOT NULL CHECK (access_type IN ('read', 'write', 'admin')),
    business_justification text NOT NULL,
    requested_at timestamp with time zone DEFAULT now(),
    approved_by uuid,
    approved_at timestamp with time zone,
    denied_by uuid,
    denied_at timestamp with time zone,
    denial_reason text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on the new table
DO $rls$ BEGIN ALTER TABLE public.formula_access_requests ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Ensure audit table exists (was created outside the migration chain originally)
CREATE TABLE IF NOT EXISTS public.formula_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  formula_id uuid,
  access_type text,
  details jsonb DEFAULT '{}'::jsonb,
  accessed_at timestamptz DEFAULT now(),
  ip_address text,
  session_id text,
  created_at timestamptz DEFAULT now()
);
DO $rls$ BEGIN ALTER TABLE public.formula_access_audit ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Stub for function defined fully in a later migration (needed by policies below)
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='log_formula_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.log_formula_access(_user_id uuid, _formula_id uuid, _access_type text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $stub$ BEGIN
DO $aud$ BEGIN INSERT INTO public.formula_access_audit (user_id, formula_id, access_type, details, accessed_at)
  VALUES (_user_id, _formula_id, _access_type, _details, now()); EXCEPTION WHEN not_null_violation OR check_violation OR foreign_key_violation THEN NULL; END $aud$;
END $stub$;

-- 3. Enhanced audit logging with IP address and session tracking
ALTER TABLE public.formula_access_audit 
ADD COLUMN IF NOT EXISTS risk_level text DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical'));

-- 4. Create enhanced formula access function with stricter controls
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='can_access_trade_secret_formula' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.can_access_trade_secret_formula(_user_id uuid, _formula_id uuid, _access_type text DEFAULT 'read'::text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    formula_classification text;
    has_role_access boolean := false;
    has_specific_access boolean := false;
    access_expired boolean := false;
BEGIN
    -- Get formula classification level
    SELECT classification_level INTO formula_classification
    FROM public.formulas 
    WHERE id = _formula_id;
    
    -- For trade secret formulas, require explicit approval even for admins
    IF formula_classification = 'trade_secret' THEN
        -- Check for explicit approval in access requests
        SELECT EXISTS (
            SELECT 1 FROM public.formula_access_requests far
            JOIN public.formula_access_permissions fap ON fap.user_id = far.user_id AND fap.formula_id = far.formula_id
            WHERE far.user_id = _user_id 
            AND far.formula_id = _formula_id
            AND far.status = 'approved'
            AND fap.is_active = true
            AND (fap.expires_at IS NULL OR fap.expires_at > now())
            AND (far.expires_at IS NULL OR far.expires_at > now())
        ) INTO has_specific_access;
        
        RETURN has_specific_access;
    END IF;
    
    -- For non-trade-secret formulas, use existing logic
    RETURN public.can_access_specific_formula(_user_id, _formula_id, _access_type);
END;
$$;

-- 5. Update the main formula access policy to use enhanced function
DO $pol$ BEGIN DROP POLICY IF EXISTS "Strict formula access with audit logging" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Enhanced trade secret formula protection" ON public.formulas; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Enhanced trade secret formula protection" 
ON public.formulas 
FOR SELECT 
USING (
    can_access_trade_secret_formula(auth.uid(), id, 'read') 
    AND (log_formula_access(auth.uid(), id, 'view', 
        jsonb_build_object(
            'classification', classification_level,
            'risk_level', CASE 
                WHEN classification_level = 'trade_secret' THEN 'critical'
                WHEN classification_level = 'confidential' THEN 'high'
                ELSE 'medium'
            END
        )) IS NULL)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 6. RLS policies for access requests
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view their own access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view their own access requests" 
ON public.formula_access_requests 
FOR SELECT 
USING (user_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can create access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can create access requests" 
ON public.formula_access_requests 
FOR INSERT 
WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Admins and R&D managers can manage access requests" ON public.formula_access_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Admins and R&D managers can manage access requests" 
ON public.formula_access_requests 
FOR ALL 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'rd_manager'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'rd_manager')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 7. Function to request formula access with approval workflow
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='request_formula_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.request_formula_access(_formula_id uuid, _access_type text, _justification text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    request_id uuid;
    formula_classification text;
BEGIN
    -- Get formula classification
    SELECT classification_level INTO formula_classification
    FROM public.formulas 
    WHERE id = _formula_id;
    
    -- Check if user already has access
    IF public.can_access_specific_formula(auth.uid(), _formula_id, _access_type) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'You already have access to this formula'
        );
    END IF;
    
    -- Check for existing pending request
    IF EXISTS (
        SELECT 1 FROM public.formula_access_requests 
        WHERE user_id = auth.uid() 
        AND formula_id = _formula_id 
        AND status = 'pending'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'You already have a pending request for this formula'
        );
    END IF;
    
    -- Create access request
    INSERT INTO public.formula_access_requests (
        user_id, formula_id, access_type, business_justification,
        expires_at
    ) VALUES (
        auth.uid(), _formula_id, _access_type, _justification,
        -- Trade secret access expires in 30 days, others in 90 days
        now() + CASE 
            WHEN formula_classification = 'trade_secret' THEN interval '30 days'
            ELSE interval '90 days'
        END
    ) RETURNING id INTO request_id;
    
    -- Log the access request
    PERFORM public.log_formula_access(auth.uid(), _formula_id, 'access_requested', 
        jsonb_build_object(
            'request_id', request_id,
            'access_type', _access_type,
            'classification', formula_classification,
            'justification', _justification
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'request_id', request_id,
        'message', 'Access request submitted for approval'
    );
END;
$$;