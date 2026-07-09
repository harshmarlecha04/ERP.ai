-- Phase 1: Customer Order Management Database Schema

-- Create customers table
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text UNIQUE NOT NULL,
  customer_code text UNIQUE NOT NULL,
  email text,
  phone text,
  is_rd_customer boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers"
  ON public.customers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create customers"
  ON public.customers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update customers"
  ON public.customers FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can delete customers"
  ON public.customers FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create customer_orders table
CREATE TABLE public.customer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT NOT NULL,
  formula_id uuid REFERENCES public.formulas(id) ON DELETE RESTRICT NOT NULL,
  order_type text NOT NULL DEFAULT 'production',
  bottles_ordered integer NOT NULL,
  bottle_size integer NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'normal',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  notes text,
  special_instructions text,
  CONSTRAINT valid_order_type CHECK (order_type IN ('production', 'rd_sample', 'rd_development')),
  CONSTRAINT valid_bottle_size CHECK (bottle_size IN (60, 90, 120)),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'materials_checked', 'scheduled', 'in_production', 'in_drying', 'in_coating', 'packaging', 'completed', 'shipped', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT positive_bottles CHECK (bottles_ordered > 0)
);

-- Enable RLS on customer_orders
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view orders"
  ON public.customer_orders FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create orders"
  ON public.customer_orders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update orders"
  ON public.customer_orders FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can delete orders"
  ON public.customer_orders FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create order_production_batches linking table
CREATE TABLE public.order_production_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_order_id uuid REFERENCES public.customer_orders(id) ON DELETE CASCADE NOT NULL,
  production_schedule_item_id uuid REFERENCES public.production_schedule_items(id) ON DELETE CASCADE NOT NULL,
  estimated_bottles integer NOT NULL,
  actual_bottles_packed integer,
  batch_sequence integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT positive_estimated_bottles CHECK (estimated_bottles > 0)
);

-- Enable RLS on order_production_batches
ALTER TABLE public.order_production_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage order batches"
  ON public.order_production_batches FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create batch_stage_tracking table
CREATE TABLE public.batch_stage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_schedule_item_id uuid REFERENCES public.production_schedule_items(id) ON DELETE CASCADE NOT NULL,
  stage text NOT NULL,
  entered_at timestamp with time zone DEFAULT now() NOT NULL,
  exited_at timestamp with time zone,
  stage_duration_hours numeric GENERATED ALWAYS AS (
    CASE 
      WHEN exited_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (exited_at - entered_at)) / 3600
      ELSE NULL
    END
  ) STORED,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  corn_starch_used_kg numeric,
  quality_check_passed boolean DEFAULT true,
  sticking_issue boolean DEFAULT false,
  CONSTRAINT valid_stage CHECK (stage IN ('production', 'drying', 'coating', 'packaging', 'completed'))
);

-- Enable RLS on batch_stage_tracking
ALTER TABLE public.batch_stage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage stage tracking"
  ON public.batch_stage_tracking FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add columns to formulas table
ALTER TABLE public.formulas 
  ADD COLUMN IF NOT EXISTS gummies_per_batch integer;

-- Add columns to production_schedule_items table
ALTER TABLE public.production_schedule_items
  ADD COLUMN IF NOT EXISTS actual_yield_kg numeric,
  ADD COLUMN IF NOT EXISTS actual_gummies_produced integer,
  ADD COLUMN IF NOT EXISTS bottles_packed integer,
  ADD COLUMN IF NOT EXISTS yield_variance_percent numeric,
  ADD COLUMN IF NOT EXISTS wastage_gummies integer,
  ADD COLUMN IF NOT EXISTS current_stage text DEFAULT 'scheduled';

-- Create function to auto-generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
  year_part text;
  order_num text;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get the next number for this year
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(order_number FROM 'CO-' || year_part || '-(\d+)') AS integer
    )
  ), 0) + 1
  INTO next_number
  FROM public.customer_orders
  WHERE order_number LIKE 'CO-' || year_part || '-%';
  
  -- Format as CO-YYYY-NNN
  order_num := 'CO-' || year_part || '-' || LPAD(next_number::text, 3, '0');
  
  RETURN order_num;
END;
$$;

-- Create function to calculate batches needed for an order
CREATE OR REPLACE FUNCTION calculate_batches_needed(
  p_formula_id uuid,
  p_bottles_ordered integer,
  p_bottle_size integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gummies_per_batch integer;
  v_total_gummies integer;
  v_batches_needed integer;
  v_estimated_bottles_per_batch integer;
BEGIN
  -- Get gummies per batch from formula
  SELECT gummies_per_batch INTO v_gummies_per_batch
  FROM public.formulas
  WHERE id = p_formula_id;
  
  IF v_gummies_per_batch IS NULL OR v_gummies_per_batch <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Formula does not have gummies_per_batch set'
    );
  END IF;
  
  -- Calculate total gummies needed
  v_total_gummies := p_bottles_ordered * p_bottle_size;
  
  -- Calculate batches needed (round up)
  v_batches_needed := CEIL(v_total_gummies::numeric / v_gummies_per_batch::numeric);
  
  -- Calculate estimated bottles per batch
  v_estimated_bottles_per_batch := FLOOR(v_gummies_per_batch::numeric / p_bottle_size::numeric);
  
  RETURN jsonb_build_object(
    'success', true,
    'total_gummies', v_total_gummies,
    'gummies_per_batch', v_gummies_per_batch,
    'batches_needed', v_batches_needed,
    'estimated_bottles_per_batch', v_estimated_bottles_per_batch
  );
END;
$$;

-- Create trigger to auto-generate order numbers
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON public.customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_orders_updated_at
  BEFORE UPDATE ON public.customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_customer_orders_customer_id ON public.customer_orders(customer_id);
CREATE INDEX idx_customer_orders_formula_id ON public.customer_orders(formula_id);
CREATE INDEX idx_customer_orders_status ON public.customer_orders(status);
CREATE INDEX idx_customer_orders_due_date ON public.customer_orders(due_date);
CREATE INDEX idx_order_production_batches_order_id ON public.order_production_batches(customer_order_id);
CREATE INDEX idx_order_production_batches_schedule_item_id ON public.order_production_batches(production_schedule_item_id);
CREATE INDEX idx_batch_stage_tracking_schedule_item_id ON public.batch_stage_tracking(production_schedule_item_id);
CREATE INDEX idx_batch_stage_tracking_stage ON public.batch_stage_tracking(stage);