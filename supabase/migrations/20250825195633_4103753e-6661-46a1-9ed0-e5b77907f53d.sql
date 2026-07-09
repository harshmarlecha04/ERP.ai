-- Check and update remaining restrictive RLS policies for production/material tables

-- Update production_schedules table  
DROP POLICY IF EXISTS "Only admins and production managers can manage production sched" ON public.production_schedules;
DROP POLICY IF EXISTS "Production managers can view production schedules" ON public.production_schedules;

CREATE POLICY "Authenticated users can manage production schedules"
ON public.production_schedules
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update production_schedule_items table
DROP POLICY IF EXISTS "Only admins and production managers can manage production items" ON public.production_schedule_items;  
DROP POLICY IF EXISTS "Production managers can view production items" ON public.production_schedule_items;

CREATE POLICY "Authenticated users can manage production schedule items"
ON public.production_schedule_items
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Update batch_records table
DROP POLICY IF EXISTS "Only admins and production managers can manage batch records" ON public.batch_records;

CREATE POLICY "Authenticated users can manage batch records"
ON public.batch_records
FOR ALL  
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);