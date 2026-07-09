-- Add fulfillment tracking columns to customer_orders
ALTER TABLE customer_orders 
ADD COLUMN IF NOT EXISTS bottles_shipped integer DEFAULT 0 CHECK (bottles_shipped >= 0),
ADD COLUMN IF NOT EXISTS bottles_remaining integer GENERATED ALWAYS AS (bottles_ordered - bottles_shipped) STORED;

-- Create order_shipments table for shipment history
CREATE TABLE IF NOT EXISTS order_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  
  -- Shipment Details
  shipped_quantity integer NOT NULL CHECK (shipped_quantity > 0),
  shipment_date date NOT NULL,
  tracking_number text,
  carrier text,
  
  -- Metadata
  shipped_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  notes text
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_shipments_order_id ON order_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_shipments_date ON order_shipments(shipment_date);

-- Enable RLS
ALTER TABLE order_shipments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_shipments
CREATE POLICY "Authenticated users can view shipments"
  ON order_shipments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create shipments"
  ON order_shipments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update shipments"
  ON order_shipments FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete shipments"
  ON order_shipments FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Function to update bottles_shipped and order status
CREATE OR REPLACE FUNCTION update_order_fulfillment()
RETURNS TRIGGER AS $$
DECLARE
  total_shipped integer;
  order_bottles integer;
BEGIN
  -- Get the order_id (handle both INSERT/UPDATE and DELETE)
  DECLARE
    target_order_id uuid;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      target_order_id := OLD.order_id;
    ELSE
      target_order_id := NEW.order_id;
    END IF;

    -- Calculate total shipped for this order
    SELECT COALESCE(SUM(shipped_quantity), 0)
    INTO total_shipped
    FROM order_shipments
    WHERE order_id = target_order_id;

    -- Get bottles ordered
    SELECT bottles_ordered
    INTO order_bottles
    FROM customer_orders
    WHERE id = target_order_id;

    -- Update the order
    UPDATE customer_orders
    SET 
      bottles_shipped = total_shipped,
      status = CASE
        WHEN total_shipped >= order_bottles THEN 'shipped'
        WHEN total_shipped > 0 THEN 'partially_shipped'
        ELSE status
      END,
      updated_at = now()
    WHERE id = target_order_id;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on INSERT/UPDATE/DELETE of shipments
DROP TRIGGER IF EXISTS trigger_update_order_fulfillment ON order_shipments;
CREATE TRIGGER trigger_update_order_fulfillment
  AFTER INSERT OR UPDATE OR DELETE ON order_shipments
  FOR EACH ROW
  EXECUTE FUNCTION update_order_fulfillment();