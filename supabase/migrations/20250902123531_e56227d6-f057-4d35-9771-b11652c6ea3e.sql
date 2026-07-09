-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.suppliers(id),
  ingredient_id UUID REFERENCES public.raw_materials(id),
  po_number TEXT NOT NULL UNIQUE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  ordered_date DATE NOT NULL,
  expected_delivery DATE,
  terms TEXT,
  invoice_total NUMERIC NOT NULL DEFAULT 0,
  tracking_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'shipped', 'delivered', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
DO $rls$ BEGIN ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- Create RLS policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage purchase orders" ON public.purchase_orders; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can manage purchase orders" 
ON public.purchase_orders 
FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON public.purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_ingredient_id ON public.purchase_orders(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_ordered_date ON public.purchase_orders(ordered_date);

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();