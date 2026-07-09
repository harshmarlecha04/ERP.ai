-- Fix critical security issue: Restrict formula access to authorized roles only
-- Trade secret formulas should only be accessible to R&D and authorized production staff

-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'rd_manager', 'production_manager', 'quality_manager', 'user');

-- Create user_roles table for proper role management
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    granted_by uuid REFERENCES auth.users(id),
    granted_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user has formula access (R&D, production managers, or admins)
CREATE OR REPLACE FUNCTION public.can_access_formulas(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'rd_manager', 'production_manager')
  )
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_formulas(uuid) TO authenticated;

-- Update RLS policies for formulas table
DROP POLICY IF EXISTS "Authenticated users can view formulas" ON public.formulas;
DROP POLICY IF EXISTS "Authenticated users can manage formulas" ON public.formulas;

-- New restrictive policies for formulas
CREATE POLICY "Only authorized roles can view formulas"
ON public.formulas
FOR SELECT
TO authenticated
USING (public.can_access_formulas(auth.uid()));

CREATE POLICY "Only R&D managers can insert formulas"
ON public.formulas
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'rd_manager') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only R&D managers can update formulas"
ON public.formulas
FOR UPDATE
TO authenticated
USING (public.can_access_formulas(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'rd_manager') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete formulas"
ON public.formulas
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for formula_ingredients table
DROP POLICY IF EXISTS "Authenticated users can view formula ingredients" ON public.formula_ingredients;
DROP POLICY IF EXISTS "Authenticated users can manage formula ingredients" ON public.formula_ingredients;

-- New restrictive policies for formula_ingredients
CREATE POLICY "Only authorized roles can view formula ingredients"
ON public.formula_ingredients
FOR SELECT
TO authenticated
USING (public.can_access_formulas(auth.uid()));

CREATE POLICY "Only R&D managers can insert formula ingredients"
ON public.formula_ingredients
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'rd_manager') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only R&D managers can update formula ingredients"
ON public.formula_ingredients
FOR UPDATE
TO authenticated
USING (public.can_access_formulas(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'rd_manager') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete formula ingredients"
ON public.formula_ingredients
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Only admins can manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create function to assign initial admin role (for setup)
CREATE OR REPLACE FUNCTION public.assign_initial_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function should only be called once during setup
  -- Assign admin role to the first user if no admins exist
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT id, 'admin'::app_role
    FROM auth.users
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
END;
$$;

-- Grant execute permission for the setup function
GRANT EXECUTE ON FUNCTION public.assign_initial_admin() TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.user_roles IS 'Role-based access control for restricting access to sensitive data like formulas';
COMMENT ON FUNCTION public.can_access_formulas(uuid) IS 'Checks if user has permission to access trade secret formulas (R&D, production managers, or admins only)';
COMMENT ON TYPE public.app_role IS 'Application roles: admin (full access), rd_manager (formula access), production_manager (formula read), quality_manager (limited access), user (basic access)';