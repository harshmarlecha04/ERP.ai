-- Add po_number column to order_headers table
ALTER TABLE order_headers 
ADD COLUMN IF NOT EXISTS po_number text;

-- Add unique constraint on po_number to prevent duplicates
ALTER TABLE order_headers DROP CONSTRAINT IF EXISTS order_headers_po_number_unique;
ALTER TABLE order_headers 
ADD CONSTRAINT order_headers_po_number_unique UNIQUE (po_number);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_headers_po_number ON order_headers(po_number);

-- Add comment for documentation
COMMENT ON COLUMN order_headers.po_number IS 'Customer purchase order number - required and unique';