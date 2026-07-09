-- Check and update remaining restrictive RLS policies for production/material tables

-- Update production_schedules table  
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins and production managers can manage production sched" ON public.production_schedules; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "Production managers can view production schedules" ON public.production_schedules; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage production schedules" ON public.production_schedules; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can manage production schedules"
ON public.production_schedules
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Update production_schedule_items table
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins and production managers can manage production items" ON public.production_schedule_items; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;  
DO $pol$ BEGIN DROP POLICY IF EXISTS "Production managers can view production items" ON public.production_schedule_items; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage production schedule items" ON public.production_schedule_items; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can manage production schedule items"
ON public.production_schedule_items
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Update batch_records table
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins and production managers can manage batch records" ON public.batch_records; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage batch records" ON public.batch_records; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can manage batch records"
ON public.batch_records
FOR ALL  
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;