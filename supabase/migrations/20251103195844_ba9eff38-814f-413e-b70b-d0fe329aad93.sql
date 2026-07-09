-- Add po_number and products columns to inquiry_order_details
ALTER TABLE inquiry_order_details 
  ADD COLUMN IF NOT EXISTS po_number TEXT,
  ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN inquiry_order_details.po_number IS 'Customer purchase order number for tracking';
COMMENT ON COLUMN inquiry_order_details.products IS 'Array of products with bottles_quantity, count_per_bottle, expected_delivery_date';