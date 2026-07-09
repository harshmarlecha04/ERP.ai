-- Create office_supply_purchases table to track individual purchase history
CREATE TABLE IF NOT EXISTS public.office_supply_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.office_supplies(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  shipping_cost NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_office_supply_purchases_item_id ON public.office_supply_purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_office_supply_purchases_purchase_date ON public.office_supply_purchases(purchase_date);

-- Enable RLS
ALTER TABLE public.office_supply_purchases ENABLE ROW LEVEL SECURITY;

-- RLS policies for office_supply_purchases
CREATE POLICY "All authenticated users can view purchases"
  ON public.office_supply_purchases
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create purchases"
  ON public.office_supply_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update purchases"
  ON public.office_supply_purchases
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete purchases"
  ON public.office_supply_purchases
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Migrate existing office_supplies data to purchases table
-- For each existing supply with cost data, create a first purchase record
INSERT INTO public.office_supply_purchases (
  item_id,
  purchase_date,
  quantity,
  unit_cost,
  shipping_cost,
  tax,
  total_cost,
  supplier,
  created_by,
  notes
)
SELECT 
  id,
  COALESCE(last_order_date, CURRENT_DATE),
  quantity_on_hand,
  unit_cost,
  shipping_cost,
  tax,
  total_cost,
  supplier,
  created_by,
  'Migrated from original office_supplies record'
FROM public.office_supplies
WHERE quantity_on_hand > 0 OR total_cost > 0
ON CONFLICT DO NOTHING;

-- Remove cost-related columns from office_supplies (they're now in purchases table)
ALTER TABLE public.office_supplies 
  DROP COLUMN IF EXISTS unit_cost,
  DROP COLUMN IF EXISTS shipping_cost,
  DROP COLUMN IF EXISTS tax,
  DROP COLUMN IF EXISTS total_cost,
  DROP COLUMN IF EXISTS last_order_date;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_office_supply_purchases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_office_supply_purchases_updated_at
  BEFORE UPDATE ON public.office_supply_purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_office_supply_purchases_updated_at();