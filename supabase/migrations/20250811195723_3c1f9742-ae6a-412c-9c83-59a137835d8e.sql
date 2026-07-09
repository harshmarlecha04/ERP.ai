-- Create user roles enum (if not exists)
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'production_manager', 'inventory_user', 'quality_user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update role column type if it exists, or add it if it doesn't
DO $$ 
BEGIN
    -- Try to alter the column type
    ALTER TABLE public.profiles ALTER COLUMN role TYPE app_role USING role::text::app_role;
EXCEPTION
    WHEN undefined_column THEN
        -- Column doesn't exist, add it
        ALTER TABLE public.profiles ADD COLUMN role app_role DEFAULT 'inventory_user'::app_role;
    WHEN others THEN
        -- Column exists but different type, add default if needed
        BEGIN
            ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'inventory_user'::app_role;
        EXCEPTION WHEN others THEN null;
        END;
END $$;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user has role level or higher
CREATE OR REPLACE FUNCTION public.has_role_level(_user_id uuid, _min_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE 
    WHEN _min_role = 'inventory_user' THEN EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = _user_id AND role IN ('inventory_user', 'quality_user', 'production_manager', 'admin')
    )
    WHEN _min_role = 'quality_user' THEN EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = _user_id AND role IN ('quality_user', 'production_manager', 'admin')
    )
    WHEN _min_role = 'production_manager' THEN EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = _user_id AND role IN ('production_manager', 'admin')
    )
    WHEN _min_role = 'admin' THEN EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = _user_id AND role = 'admin'
    )
    ELSE false
  END
$$;

-- Drop existing permissive RLS policies and create role-based ones

-- Formulas table - only production managers and admins
DROP POLICY IF EXISTS "Authenticated users can view formulas" ON public.formulas;
DROP POLICY IF EXISTS "Authenticated users can manage formulas" ON public.formulas;

CREATE POLICY "Production managers can view formulas" 
ON public.formulas FOR SELECT 
USING (public.has_role_level(auth.uid(), 'production_manager'));

CREATE POLICY "Production managers can manage formulas" 
ON public.formulas FOR ALL 
USING (public.has_role_level(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role_level(auth.uid(), 'production_manager'));

-- Formula ingredients - same as formulas
DROP POLICY IF EXISTS "Authenticated users can view formula ingredients" ON public.formula_ingredients;
DROP POLICY IF EXISTS "Authenticated users can manage formula ingredients" ON public.formula_ingredients;

CREATE POLICY "Production managers can view formula ingredients" 
ON public.formula_ingredients FOR SELECT 
USING (public.has_role_level(auth.uid(), 'production_manager'));

CREATE POLICY "Production managers can manage formula ingredients" 
ON public.formula_ingredients FOR ALL 
USING (public.has_role_level(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role_level(auth.uid(), 'production_manager'));

-- Suppliers - only production managers and admins
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers;

CREATE POLICY "Production managers can view suppliers" 
ON public.suppliers FOR SELECT 
USING (public.has_role_level(auth.uid(), 'production_manager'));

CREATE POLICY "Production managers can manage suppliers" 
ON public.suppliers FOR ALL 
USING (public.has_role_level(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role_level(auth.uid(), 'production_manager'));

-- Raw materials - inventory users can view, production managers can manage
DROP POLICY IF EXISTS "Authenticated users can view raw materials" ON public.raw_materials;
DROP POLICY IF EXISTS "Authenticated users can manage raw materials" ON public.raw_materials;

CREATE POLICY "Inventory users can view raw materials" 
ON public.raw_materials FOR SELECT 
USING (public.has_role_level(auth.uid(), 'inventory_user'));

CREATE POLICY "Production managers can manage raw materials" 
ON public.raw_materials FOR ALL 
USING (public.has_role_level(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role_level(auth.uid(), 'production_manager'));

-- Raw material lots - inventory users can view, production managers can manage
DROP POLICY IF EXISTS "Authenticated users can view raw material lots" ON public.raw_material_lots;
DROP POLICY IF EXISTS "Authenticated users can manage raw material lots" ON public.raw_material_lots;

CREATE POLICY "Inventory users can view raw material lots" 
ON public.raw_material_lots FOR SELECT 
USING (public.has_role_level(auth.uid(), 'inventory_user'));

CREATE POLICY "Production managers can manage raw material lots" 
ON public.raw_material_lots FOR ALL 
USING (public.has_role_level(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role_level(auth.uid(), 'production_manager'));

-- Production schedules - production managers and admins
DROP POLICY IF EXISTS "Authenticated users can view production schedules" ON public.production_schedules;
DROP POLICY IF EXISTS "Authenticated users can manage production schedules" ON public.production_schedules;

CREATE POLICY "Production managers can view production schedules" 
ON public.production_schedules FOR SELECT 
USING (public.has_role_level(auth.uid(), 'production_manager'));

CREATE POLICY "Production managers can manage production schedules" 
ON public.production_schedules FOR ALL 
USING (public.has_role_level(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role_level(auth.uid(), 'production_manager'));

-- Production schedule items - production managers and admins
DROP POLICY IF EXISTS "Authenticated users can view production items" ON public.production_schedule_items;
DROP POLICY IF EXISTS "Authenticated users can manage production items" ON public.production_schedule_items;

CREATE POLICY "Production managers can view production items" 
ON public.production_schedule_items FOR SELECT 
USING (public.has_role_level(auth.uid(), 'production_manager'));

CREATE POLICY "Production managers can manage production items" 
ON public.production_schedule_items FOR ALL 
USING (public.has_role_level(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role_level(auth.uid(), 'production_manager'));

-- Inventory reservations - production managers and admins
DROP POLICY IF EXISTS "Authenticated users can view inventory reservations" ON public.inventory_reservations;
DROP POLICY IF EXISTS "Authenticated users can manage inventory reservations" ON public.inventory_reservations;

CREATE POLICY "Production managers can view inventory reservations" 
ON public.inventory_reservations FOR SELECT 
USING (public.has_role_level(auth.uid(), 'production_manager'));

CREATE POLICY "Production managers can manage inventory reservations" 
ON public.inventory_reservations FOR ALL 
USING (public.has_role_level(auth.uid(), 'production_manager'))
WITH CHECK (public.has_role_level(auth.uid(), 'production_manager'));

-- Add email domain validation trigger
CREATE OR REPLACE FUNCTION public.validate_email_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email NOT LIKE '%@pharmvista.com' THEN
    RAISE EXCEPTION 'Email must be from pharmvista.com domain';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for email validation on profiles
DROP TRIGGER IF EXISTS validate_email_domain_trigger ON public.profiles;
CREATE TRIGGER validate_email_domain_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_email_domain();

-- Update handle_new_user function to include email domain validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate email domain
  IF NEW.email NOT LIKE '%@pharmvista.com' THEN
    RAISE EXCEPTION 'Email must be from pharmvista.com domain';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, job_title)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'job_title'
  );
  RETURN NEW;
END;
$$;