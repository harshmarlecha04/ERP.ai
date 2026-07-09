-- Fix overly permissive RLS policies on production and inventory tables
-- Replace "USING condition: true" with proper role-based access controls

-- 1. Update suppliers table policies
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers;

CREATE POLICY "Procurement and finance can view suppliers" 
ON public.suppliers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role) OR
  -- Allow users who can access suppliers based on their department role
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'production_manager')
  )
);

CREATE POLICY "Only admins and production managers can manage suppliers" 
ON public.suppliers 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

-- 2. Update raw_materials table policies  
DROP POLICY IF EXISTS "Authenticated users can view raw materials" ON public.raw_materials;
DROP POLICY IF EXISTS "Authenticated users can manage raw materials" ON public.raw_materials;

CREATE POLICY "Production and procurement can view raw materials" 
ON public.raw_materials 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role) OR
  has_role(auth.uid(), 'rd_manager'::app_role)
);

CREATE POLICY "Only admins and production managers can manage raw materials" 
ON public.raw_materials 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

-- 3. Update raw_material_lots table policies
DROP POLICY IF EXISTS "Authenticated users can view raw material lots" ON public.raw_material_lots;
DROP POLICY IF EXISTS "Authenticated users can manage raw material lots" ON public.raw_material_lots;

CREATE POLICY "Production and procurement can view raw material lots" 
ON public.raw_material_lots 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role) OR
  has_role(auth.uid(), 'rd_manager'::app_role)
);

CREATE POLICY "Only admins and production managers can manage raw material lots" 
ON public.raw_material_lots 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

-- 4. Update production_schedules table policies
DROP POLICY IF EXISTS "Authenticated users can view production schedules" ON public.production_schedules;
DROP POLICY IF EXISTS "Authenticated users can manage production schedules" ON public.production_schedules;

CREATE POLICY "Production managers can view production schedules" 
ON public.production_schedules 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Only admins and production managers can manage production schedules" 
ON public.production_schedules 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

-- 5. Update production_schedule_items table policies
DROP POLICY IF EXISTS "Authenticated users can view production items" ON public.production_schedule_items;
DROP POLICY IF EXISTS "Authenticated users can manage production items" ON public.production_schedule_items;

CREATE POLICY "Production managers can view production items" 
ON public.production_schedule_items 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Only admins and production managers can manage production items" 
ON public.production_schedule_items 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

-- 6. Update inventory_reservations table policies
DROP POLICY IF EXISTS "Authenticated users can view inventory reservations" ON public.inventory_reservations;
DROP POLICY IF EXISTS "Authenticated users can manage inventory reservations" ON public.inventory_reservations;

CREATE POLICY "Production managers can view inventory reservations" 
ON public.inventory_reservations 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Only admins and production managers can manage inventory reservations" 
ON public.inventory_reservations 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);