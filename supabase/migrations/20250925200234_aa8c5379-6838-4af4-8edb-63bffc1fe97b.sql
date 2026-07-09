-- Create corrugated_shippers table for storing shipper inventory
CREATE TABLE IF NOT EXISTS public.corrugated_shippers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  bottles_per_box NUMERIC NOT NULL DEFAULT 0,
  total_bottles NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
DO $rls$ BEGIN ALTER TABLE public.corrugated_shippers ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Create policies for authenticated users
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view corrugated shippers" ON public.corrugated_shippers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view corrugated shippers" 
ON public.corrugated_shippers 
FOR SELECT 
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can create corrugated shippers" ON public.corrugated_shippers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can create corrugated shippers" 
ON public.corrugated_shippers 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update corrugated shippers" ON public.corrugated_shippers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can update corrugated shippers" 
ON public.corrugated_shippers 
FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete corrugated shippers" ON public.corrugated_shippers; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can delete corrugated shippers" 
ON public.corrugated_shippers 
FOR DELETE 
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create function to update timestamps
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='update_corrugated_shippers_updated_at' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.update_corrugated_shippers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_corrugated_shippers_updated_at ON public.corrugated_shippers;
CREATE TRIGGER update_corrugated_shippers_updated_at
BEFORE UPDATE ON public.corrugated_shippers
FOR EACH ROW
EXECUTE FUNCTION public.update_corrugated_shippers_updated_at();