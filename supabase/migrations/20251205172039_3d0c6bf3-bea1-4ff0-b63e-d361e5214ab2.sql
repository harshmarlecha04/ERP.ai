-- Drop the old constraint
ALTER TABLE order_line_items DROP CONSTRAINT IF EXISTS order_line_items_bottle_size_check;

-- Add new constraint with 70 included
ALTER TABLE order_line_items ADD CONSTRAINT order_line_items_bottle_size_check 
CHECK (bottle_size = ANY (ARRAY[60, 70, 90, 120]));