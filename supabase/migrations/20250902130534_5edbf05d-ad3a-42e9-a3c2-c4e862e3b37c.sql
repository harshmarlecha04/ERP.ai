-- Fix critical security vulnerability: Add RLS policies to raw_material_usage_stats table
-- This table contains sensitive manufacturing data and must be protected

-- Enable Row Level Security on the raw_material_usage_stats table
ALTER TABLE public.raw_material_usage_stats ENABLE ROW LEVEL SECURITY;

-- Create policy to restrict access to admin and production_manager roles only
-- This aligns with the existing get_raw_material_usage_stats() function permissions
CREATE POLICY "Only admins and production managers can view usage stats" 
ON public.raw_material_usage_stats 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

-- Create policy for system operations (like materialized view refreshes)
-- This allows the system to update the table as needed
CREATE POLICY "System can manage usage stats data" 
ON public.raw_material_usage_stats 
FOR ALL 
USING (auth.role() = 'service_role');