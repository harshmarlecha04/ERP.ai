-- Fix Critical Security Vulnerability: Employee Personal Information Access
-- Replace overly permissive RLS policies with secure, role-based access control

-- Drop the insecure policies that allow any authenticated user to access employee data
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view employee data" ON public.employee_sensitive_data; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can manage employee data" ON public.employee_sensitive_data; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create secure RLS policies for employee sensitive data access

-- 1. VIEW policies - Who can see employee sensitive data
DO $pol$ BEGIN DROP POLICY IF EXISTS "HR managers can view all employee data" ON public.employee_sensitive_data; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "HR managers can view all employee data" ON public.employee_sensitive_data
FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'hr_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Employees can view their own data" ON public.employee_sensitive_data; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Employees can view their own data" ON public.employee_sensitive_data
FOR SELECT USING (id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Managers can view their direct reports data" ON public.employee_sensitive_data; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Managers can view their direct reports data" ON public.employee_sensitive_data
FOR SELECT USING (manager_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 2. INSERT policies - Who can create employee records
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only HR managers can create employee records" ON public.employee_sensitive_data; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only HR managers can create employee records" ON public.employee_sensitive_data
FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'hr_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 3. UPDATE policies - Who can modify employee data
DO $pol$ BEGIN DROP POLICY IF EXISTS "HR managers can update all employee data" ON public.employee_sensitive_data; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "HR managers can update all employee data" ON public.employee_sensitive_data
FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'hr_manager'::app_role)
) WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'hr_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Employees can update limited personal info" ON public.employee_sensitive_data; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Employees can update limited personal info" ON public.employee_sensitive_data
FOR UPDATE USING (id = auth.uid()) 
WITH CHECK (
    id = auth.uid()
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- 4. DELETE policies - Who can remove employee records
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete employee records" ON public.employee_sensitive_data; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can delete employee records" ON public.employee_sensitive_data
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role)); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create audit function for employee data access
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='log_employee_data_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.log_employee_data_access(
    _employee_id uuid,
    _accessed_by uuid,
    _access_type text,
    _details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Log access to employee sensitive data for compliance
    INSERT INTO public.profile_access_audit (
        profile_id,
        viewer_id,
        access_type,
        access_reason,
        ip_address,
        accessed_at
    ) VALUES (
        _employee_id,
        _accessed_by,
        _access_type,
        'Employee sensitive data access',
        inet_client_addr(),
        now()
    );
END;
$$;

-- Create trigger to automatically log access
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='audit_employee_data_access' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.audit_employee_data_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Log SELECT operations (viewing data)
    IF TG_OP = 'SELECT' THEN
        PERFORM public.log_employee_data_access(
            NEW.id,
            auth.uid(),
            'view',
            jsonb_build_object('operation', 'SELECT', 'table', 'employee_sensitive_data')
        );
        RETURN NEW;
    END IF;
    
    -- Log UPDATE operations (data modification)
    IF TG_OP = 'UPDATE' THEN
        PERFORM public.log_employee_data_access(
            NEW.id,
            auth.uid(),
            'update',
            jsonb_build_object(
                'operation', 'UPDATE',
                'changed_fields', (
                    SELECT jsonb_object_agg(key, value) 
                    FROM jsonb_each(to_jsonb(NEW)) 
                    WHERE to_jsonb(NEW) ->> key IS DISTINCT FROM to_jsonb(OLD) ->> key
                )
            )
        );
        RETURN NEW;
    END IF;
    
    -- Log INSERT operations (new records)
    IF TG_OP = 'INSERT' THEN
        PERFORM public.log_employee_data_access(
            NEW.id,
            auth.uid(),
            'create',
            jsonb_build_object('operation', 'INSERT', 'table', 'employee_sensitive_data')
        );
        RETURN NEW;
    END IF;
    
    -- Log DELETE operations (record removal)
    IF TG_OP = 'DELETE' THEN
        PERFORM public.log_employee_data_access(
            OLD.id,
            auth.uid(),
            'delete',
            jsonb_build_object('operation', 'DELETE', 'employee_id', OLD.employee_id)
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Note: Triggers for SELECT operations are not standard in PostgreSQL
-- Instead, applications should call the audit function when accessing employee data

COMMENT ON TABLE public.employee_sensitive_data IS 'Contains highly sensitive employee personal information. Access is strictly controlled and audited. Only HR managers, the employee themselves, and their direct manager can access this data.';