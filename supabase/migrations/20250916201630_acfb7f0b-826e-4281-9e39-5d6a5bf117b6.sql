-- Create packaging_item table
CREATE TABLE IF NOT EXISTS public.packaging_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('BOTTLES','CAPS','POUCHES','CORRUGATED')),
    item_name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    uom TEXT DEFAULT 'ea',
    location TEXT,
    min_level NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique index for category and item_name combination
CREATE UNIQUE INDEX IF NOT EXISTS packaging_item_cat_name_idx
ON public.packaging_item (category, item_name);

-- Create packaging_movement table
CREATE TABLE IF NOT EXISTS public.packaging_movement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.packaging_item(id) ON DELETE CASCADE,
    move_date DATE NOT NULL,
    move_type TEXT NOT NULL CHECK (move_type IN ('RECEIPT','USAGE','ADJUSTMENT','RETURN')),
    qty NUMERIC NOT NULL,
    po TEXT,
    vendor TEXT,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS packaging_movement_item_id_idx ON public.packaging_movement(item_id);
CREATE INDEX IF NOT EXISTS packaging_movement_date_idx ON public.packaging_movement(move_date);
CREATE INDEX IF NOT EXISTS packaging_movement_type_idx ON public.packaging_movement(move_type);

-- Enable RLS on both tables
DO $rls$ BEGIN ALTER TABLE public.packaging_item ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $rls$ BEGIN ALTER TABLE public.packaging_movement ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Create RLS policies for packaging_item
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view packaging items" ON public.packaging_item; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view packaging items" 
ON public.packaging_item 
FOR SELECT 
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can create packaging items" ON public.packaging_item; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can create packaging items" 
ON public.packaging_item 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update packaging items" ON public.packaging_item; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can update packaging items" 
ON public.packaging_item 
FOR UPDATE 
USING (auth.uid() IS NOT NULL) 
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete packaging items" ON public.packaging_item; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can delete packaging items" 
ON public.packaging_item 
FOR DELETE 
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create RLS policies for packaging_movement
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view packaging movements" ON public.packaging_movement; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view packaging movements" 
ON public.packaging_movement 
FOR SELECT 
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can create packaging movements" ON public.packaging_movement; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can create packaging movements" 
ON public.packaging_movement 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update packaging movements" ON public.packaging_movement; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can update packaging movements" 
ON public.packaging_movement 
FOR UPDATE 
USING (auth.uid() IS NOT NULL) 
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete packaging movements" ON public.packaging_movement; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can delete packaging movements" 
ON public.packaging_movement 
FOR DELETE 
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create function to update timestamps
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='update_packaging_item_updated_at' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.update_packaging_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_packaging_item_updated_at ON public.packaging_item;
CREATE TRIGGER update_packaging_item_updated_at
    BEFORE UPDATE ON public.packaging_item
    FOR EACH ROW
    EXECUTE FUNCTION public.update_packaging_item_updated_at();

-- Create view for packaging balances
CREATE OR REPLACE VIEW public.v_packaging_balances AS
SELECT
    i.id as item_id,
    i.category,
    i.item_name,
    i.description,
    i.sku,
    i.uom,
    i.location,
    i.min_level,
    i.notes,
    COALESCE(SUM(m.qty), 0) AS on_hand,
    i.created_at,
    i.updated_at
FROM public.packaging_item i
LEFT JOIN public.packaging_movement m ON m.item_id = i.id
GROUP BY i.id, i.category, i.item_name, i.description, i.sku, i.uom, i.location, i.min_level, i.notes, i.created_at, i.updated_at;

-- Create view for packaging history
CREATE OR REPLACE VIEW public.v_packaging_history AS
SELECT
    m.id,
    m.item_id,
    i.category,
    i.item_name,
    m.move_date,
    m.move_type,
    m.qty,
    m.po,
    m.vendor,
    COALESCE(m.location, i.location) AS location,
    m.notes,
    m.created_at
FROM public.packaging_movement m
JOIN public.packaging_item i ON i.id = m.item_id
ORDER BY m.move_date DESC, m.created_at DESC;