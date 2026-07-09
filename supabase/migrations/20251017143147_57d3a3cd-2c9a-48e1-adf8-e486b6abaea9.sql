-- Create bright_stock table for excess production inventory
CREATE TABLE public.bright_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID NOT NULL REFERENCES public.formulas(id) ON DELETE CASCADE,
  bottle_size INTEGER NOT NULL,
  quantity_bottles INTEGER NOT NULL CHECK (quantity_bottles >= 0),
  production_date DATE NOT NULL,
  production_schedule_item_id UUID REFERENCES public.production_schedule_items(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  notes TEXT,
  is_allocated BOOLEAN NOT NULL DEFAULT false,
  allocated_to_order_id UUID REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns to customer_orders for tracking bottle sources
ALTER TABLE public.customer_orders
ADD COLUMN bottles_from_bright_stock INTEGER DEFAULT 0,
ADD COLUMN bottles_from_new_production INTEGER DEFAULT 0;

-- Add columns to order_production_batches for bright stock tracking
ALTER TABLE public.order_production_batches
ADD COLUMN is_bright_stock BOOLEAN DEFAULT false,
ADD COLUMN bright_stock_id UUID REFERENCES public.bright_stock(id) ON DELETE SET NULL;

-- Enable RLS on bright_stock
ALTER TABLE public.bright_stock ENABLE ROW LEVEL SECURITY;

-- Policies for bright_stock
CREATE POLICY "Authenticated users can view bright stock"
  ON public.bright_stock FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage bright stock"
  ON public.bright_stock FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for common queries
CREATE INDEX idx_bright_stock_formula_bottle ON public.bright_stock(formula_id, bottle_size) WHERE NOT is_allocated;
CREATE INDEX idx_bright_stock_allocated ON public.bright_stock(is_allocated, production_date);

-- Add comments
COMMENT ON TABLE public.bright_stock IS 'Tracks excess production bottles available for future orders';
COMMENT ON COLUMN public.bright_stock.quantity_bottles IS 'Number of bottles available in bright stock';
COMMENT ON COLUMN public.bright_stock.is_allocated IS 'Whether this bright stock has been allocated to an order';
COMMENT ON COLUMN public.customer_orders.bottles_from_bright_stock IS 'Number of bottles fulfilled from existing bright stock';
COMMENT ON COLUMN public.customer_orders.bottles_from_new_production IS 'Number of bottles requiring new production';
COMMENT ON COLUMN public.order_production_batches.is_bright_stock IS 'Whether this batch represents bright stock allocation rather than new production';