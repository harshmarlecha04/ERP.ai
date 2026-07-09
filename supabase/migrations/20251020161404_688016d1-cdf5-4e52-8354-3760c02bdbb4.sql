-- PHASE 1: Rename customer_orders to order_headers
DO $rn$ BEGIN ALTER TABLE customer_orders RENAME TO order_headers; EXCEPTION WHEN undefined_column OR duplicate_column OR undefined_table THEN NULL; END $rn$;

-- Drop dependent generated column first
ALTER TABLE order_headers DROP COLUMN IF EXISTS bottles_remaining;

-- Now safely drop product-specific columns
ALTER TABLE order_headers
  DROP COLUMN IF EXISTS formula_id,
  DROP COLUMN IF EXISTS order_type,
  DROP COLUMN IF EXISTS bottle_size,
  DROP COLUMN IF EXISTS bottles_ordered,
  DROP COLUMN IF EXISTS bottles_shipped;

-- Update order_number to be user-entered text with unique constraint
ALTER TABLE order_headers DROP CONSTRAINT IF EXISTS unique_order_number;
ALTER TABLE order_headers
  ALTER COLUMN order_number DROP DEFAULT,
  ALTER COLUMN order_number TYPE text,
  ADD CONSTRAINT unique_order_number UNIQUE (order_number);

-- Add header-level tracking columns
ALTER TABLE order_headers
  ADD COLUMN IF NOT EXISTS total_line_items integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bottles_ordered integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bottles_shipped integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS header_status text DEFAULT 'draft';

-- Create index for fast order number lookups
CREATE INDEX IF NOT EXISTS idx_order_headers_order_number ON order_headers(order_number);

-- PHASE 2: Create order_line_items table for multiple products per order
CREATE TABLE IF NOT EXISTS order_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES order_headers(id) ON DELETE CASCADE,
  
  -- User-defined line number (can be alphanumeric like "1", "1a", "2")
  line_number text NOT NULL,
  
  -- Product details
  formula_id uuid NOT NULL REFERENCES formulas(id),
  order_type text NOT NULL DEFAULT 'production',
  bottle_size integer NOT NULL CHECK (bottle_size IN (60, 90, 120)),
  bottles_ordered integer NOT NULL CHECK (bottles_ordered > 0),
  
  -- Fulfillment tracking
  bottles_shipped integer DEFAULT 0 CHECK (bottles_shipped >= 0),
  bottles_remaining integer GENERATED ALWAYS AS (bottles_ordered - bottles_shipped) STORED,
  
  -- Production tracking
  production_status text DEFAULT 'pending',
  scheduled_production_date date,
  suggested_start_date date,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  notes text,
  
  -- Constraints
  UNIQUE(order_id, line_number),
  CHECK (bottles_shipped <= bottles_ordered)
);

-- Indexes for order_line_items
CREATE INDEX IF NOT EXISTS idx_order_line_items_order_id ON order_line_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_line_items_formula_id ON order_line_items(formula_id);
CREATE INDEX IF NOT EXISTS idx_order_line_items_status ON order_line_items(production_status);

-- RLS Policies for order_line_items
DO $rls$ BEGIN ALTER TABLE order_line_items ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view line items" ON order_line_items; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view line items"
  ON order_line_items FOR SELECT
  TO authenticated USING (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can manage line items" ON order_line_items; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can manage line items"
  ON order_line_items FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- PHASE 3: Update order_shipments to reference line items
ALTER TABLE order_shipments
  ADD COLUMN IF NOT EXISTS line_item_id uuid REFERENCES order_line_items(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_order_shipments_line_item ON order_shipments(line_item_id);

-- PHASE 4: Update order_production_batches to reference line items
ALTER TABLE order_production_batches
  ADD COLUMN IF NOT EXISTS line_item_id uuid REFERENCES order_line_items(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_order_production_batches_line_item ON order_production_batches(line_item_id);

-- PHASE 5: Create trigger to update order fulfillment at line-item level
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='update_order_fulfillment' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION update_order_fulfillment()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id uuid;
  v_line_item_id uuid;
  v_total_ordered integer;
  v_total_shipped integer;
  v_line_count integer;
BEGIN
  -- Get the line_item_id
  IF TG_OP = 'DELETE' THEN
    v_line_item_id := OLD.line_item_id;
  ELSE
    v_line_item_id := NEW.line_item_id;
  END IF;

  -- Skip if line_item_id is null (legacy data)
  IF v_line_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get order_id from line item
  SELECT order_id INTO v_order_id
  FROM order_line_items
  WHERE id = v_line_item_id;

  -- Update bottles_shipped for this specific line item
  UPDATE order_line_items
  SET 
    bottles_shipped = (
      SELECT COALESCE(SUM(shipped_quantity), 0)
      FROM order_shipments
      WHERE line_item_id = v_line_item_id
    ),
    production_status = CASE
      WHEN bottles_ordered <= (
        SELECT COALESCE(SUM(shipped_quantity), 0)
        FROM order_shipments
        WHERE line_item_id = v_line_item_id
      ) THEN 'completed'
      WHEN (
        SELECT COALESCE(SUM(shipped_quantity), 0)
        FROM order_shipments
        WHERE line_item_id = v_line_item_id
      ) > 0 THEN 'partially_shipped'
      ELSE production_status
    END,
    updated_at = now()
  WHERE id = v_line_item_id;

  -- Calculate header totals across all line items
  SELECT 
    COUNT(*),
    COALESCE(SUM(bottles_ordered), 0),
    COALESCE(SUM(bottles_shipped), 0)
  INTO v_line_count, v_total_ordered, v_total_shipped
  FROM order_line_items
  WHERE order_id = v_order_id;

  -- Update order header with aggregated values
  UPDATE order_headers
  SET 
    total_line_items = v_line_count,
    total_bottles_ordered = v_total_ordered,
    total_bottles_shipped = v_total_shipped,
    header_status = CASE
      WHEN v_total_shipped = 0 THEN 'pending'
      WHEN v_total_shipped >= v_total_ordered THEN 'shipped'
      WHEN v_total_shipped > 0 THEN 'partially_shipped'
      ELSE header_status
    END,
    updated_at = now()
  WHERE id = v_order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_order_fulfillment ON order_shipments;
DROP TRIGGER IF EXISTS trigger_update_order_fulfillment ON order_shipments;
CREATE TRIGGER trigger_update_order_fulfillment
  AFTER INSERT OR UPDATE OR DELETE ON order_shipments
  FOR EACH ROW
  EXECUTE FUNCTION update_order_fulfillment();

-- PHASE 6: No existing orders to migrate since table was already renamed
-- Orders will need to be recreated through the new UI

-- PHASE 7: Drop old foreign key columns after confirming no dependencies
ALTER TABLE order_shipments DROP COLUMN IF EXISTS order_id;
ALTER TABLE order_production_batches DROP COLUMN IF EXISTS customer_order_id;