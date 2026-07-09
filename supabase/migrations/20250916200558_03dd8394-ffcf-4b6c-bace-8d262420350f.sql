-- Create label_inventory table
CREATE TABLE IF NOT EXISTS public.label_inventory (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_product TEXT NOT NULL,
    date DATE NOT NULL,
    received_qty NUMERIC DEFAULT 0,
    used_qty NUMERIC DEFAULT 0,
    on_hand NUMERIC DEFAULT 0,
    source_sheet TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_label_inventory_customer_product ON public.label_inventory(customer_product);
CREATE INDEX IF NOT EXISTS idx_label_inventory_date ON public.label_inventory(date);
CREATE INDEX IF NOT EXISTS idx_label_inventory_customer_product_date ON public.label_inventory(customer_product, date);

-- Enable Row Level Security
DO $rls$ BEGIN ALTER TABLE public.label_inventory ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Create RLS policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view label inventory" ON public.label_inventory; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view label inventory" 
ON public.label_inventory 
FOR SELECT 
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can create label inventory records" ON public.label_inventory; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can create label inventory records" 
ON public.label_inventory 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update label inventory records" ON public.label_inventory; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can update label inventory records" 
ON public.label_inventory 
FOR UPDATE 
USING (auth.uid() IS NOT NULL) 
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete label inventory records" ON public.label_inventory; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can delete label inventory records" 
ON public.label_inventory 
FOR DELETE 
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create function to update timestamps
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='update_label_inventory_updated_at' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.update_label_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_label_inventory_updated_at ON public.label_inventory;
CREATE TRIGGER update_label_inventory_updated_at
    BEFORE UPDATE ON public.label_inventory
    FOR EACH ROW
    EXECUTE FUNCTION public.update_label_inventory_updated_at();