-- Emergency Database Lockdown: Replace overly permissive RLS policies
-- Drop all existing "Anyone can..." policies that use 'true' conditions

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view formula ingredients" ON public.formula_ingredients;
DROP POLICY IF EXISTS "Anyone can insert formula ingredients" ON public.formula_ingredients;
DROP POLICY IF EXISTS "Anyone can update formula ingredients" ON public.formula_ingredients;
DROP POLICY IF EXISTS "Anyone can delete formula ingredients" ON public.formula_ingredients;

DROP POLICY IF EXISTS "Anyone can view formulas" ON public.formulas;
DROP POLICY IF EXISTS "Anyone can insert formulas" ON public.formulas;
DROP POLICY IF EXISTS "Anyone can update formulas" ON public.formulas;
DROP POLICY IF EXISTS "Anyone can delete formulas" ON public.formulas;

DROP POLICY IF EXISTS "Anyone can view inventory reservations" ON public.inventory_reservations;
DROP POLICY IF EXISTS "Anyone can insert inventory reservations" ON public.inventory_reservations;
DROP POLICY IF EXISTS "Anyone can update inventory reservations" ON public.inventory_reservations;
DROP POLICY IF EXISTS "Anyone can delete inventory reservations" ON public.inventory_reservations;

DROP POLICY IF EXISTS "Anyone can view production items" ON public.production_schedule_items;
DROP POLICY IF EXISTS "Anyone can insert production items" ON public.production_schedule_items;
DROP POLICY IF EXISTS "Anyone can update production items" ON public.production_schedule_items;
DROP POLICY IF EXISTS "Anyone can delete production items" ON public.production_schedule_items;

DROP POLICY IF EXISTS "Anyone can view production schedules" ON public.production_schedules;
DROP POLICY IF EXISTS "Anyone can insert production schedules" ON public.production_schedules;
DROP POLICY IF EXISTS "Anyone can update production schedules" ON public.production_schedules;
DROP POLICY IF EXISTS "Anyone can delete production schedules" ON public.production_schedules;

DROP POLICY IF EXISTS "Anyone can view raw material lots" ON public.raw_material_lots;
DROP POLICY IF EXISTS "Anyone can insert raw material lots" ON public.raw_material_lots;
DROP POLICY IF EXISTS "Anyone can update raw material lots" ON public.raw_material_lots;
DROP POLICY IF EXISTS "Anyone can delete raw material lots" ON public.raw_material_lots;

DROP POLICY IF EXISTS "Anyone can view raw materials" ON public.raw_materials;
DROP POLICY IF EXISTS "Anyone can insert raw materials" ON public.raw_materials;
DROP POLICY IF EXISTS "Anyone can update raw materials" ON public.raw_materials;
DROP POLICY IF EXISTS "Anyone can delete raw materials" ON public.raw_materials;

DROP POLICY IF EXISTS "Anyone can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Anyone can create suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Anyone can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Anyone can delete suppliers" ON public.suppliers;

-- Create secure RLS policies that require authentication
-- Formula ingredients
CREATE POLICY "Authenticated users can view formula ingredients" ON public.formula_ingredients
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage formula ingredients" ON public.formula_ingredients
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Formulas
CREATE POLICY "Authenticated users can view formulas" ON public.formulas
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage formulas" ON public.formulas
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inventory reservations
CREATE POLICY "Authenticated users can view inventory reservations" ON public.inventory_reservations
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage inventory reservations" ON public.inventory_reservations
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Production schedule items
CREATE POLICY "Authenticated users can view production items" ON public.production_schedule_items
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage production items" ON public.production_schedule_items
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Production schedules
CREATE POLICY "Authenticated users can view production schedules" ON public.production_schedules
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage production schedules" ON public.production_schedules
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Raw material lots
CREATE POLICY "Authenticated users can view raw material lots" ON public.raw_material_lots
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage raw material lots" ON public.raw_material_lots
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Raw materials
CREATE POLICY "Authenticated users can view raw materials" ON public.raw_materials
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage raw materials" ON public.raw_materials
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Suppliers
CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage suppliers" ON public.suppliers
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text DEFAULT 'user' CHECK (role IN ('admin', 'operator', 'viewer')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  RETURN new;
END;
$$;

-- Trigger for new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add updated_at trigger for profiles
CREATE OR REPLACE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();