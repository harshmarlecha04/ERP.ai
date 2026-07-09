-- Enable Row Level Security on raw_material_usage_stats table
DO $rls$ BEGIN ALTER TABLE public.raw_material_usage_stats ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Add policy to allow only admins and production managers to view usage statistics
-- This prevents unauthorized access to sensitive business intelligence data
DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins and production managers can view usage stats" ON public.raw_material_usage_stats; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins and production managers can view usage stats" 
ON public.raw_material_usage_stats 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;