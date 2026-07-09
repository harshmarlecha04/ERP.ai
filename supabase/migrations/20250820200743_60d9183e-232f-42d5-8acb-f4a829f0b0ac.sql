-- Enable Row Level Security on raw_material_usage_stats table
ALTER TABLE public.raw_material_usage_stats ENABLE ROW LEVEL SECURITY;

-- Add policy to allow only admins and production managers to view usage statistics
-- This prevents unauthorized access to sensitive business intelligence data
CREATE POLICY "Only admins and production managers can view usage stats" 
ON public.raw_material_usage_stats 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);