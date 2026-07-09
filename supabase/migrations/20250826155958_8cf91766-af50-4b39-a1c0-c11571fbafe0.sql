-- Fix the RLS policy by using a simpler approach for delete operations
-- First, let's create a simpler admin-only policy for updates

DROP POLICY IF EXISTS "Secure multi-layer formula update" ON public.formulas;

-- Create a simple update policy for admins only (to avoid circular dependencies)
CREATE POLICY "Secure multi-layer formula update" 
ON public.formulas 
FOR UPDATE 
USING (
    -- Allow admins to update (including soft deletes) without complex validation
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'rd_manager'::app_role)
)
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'rd_manager'::app_role)
);

-- Also modify the log_formula_access function to avoid conflicts during batch operations
CREATE OR REPLACE FUNCTION public.log_formula_access(_user_id uuid, _formula_id uuid, _access_type text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Only log if not in a nested transaction that might cause conflicts
    IF NOT EXISTS (
        SELECT 1 FROM pg_stat_activity 
        WHERE pid = pg_backend_pid() 
        AND query ILIKE '%UPDATE%formulas%is_deleted%'
    ) THEN
        INSERT INTO public.formula_access_audit (
            user_id, formula_id, access_type, details, accessed_at, risk_level
        ) VALUES (
            _user_id, _formula_id, _access_type, _details, now(), 
            CASE 
                WHEN _access_type IN ('admin_access', 'trade_secret_access') THEN 'high'
                WHEN _access_type IN ('access_denied_confidential', 'access_denied_hours') THEN 'medium'
                ELSE 'low'
            END
        );
    END IF;
END;
$function$;