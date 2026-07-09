-- Add packaging selection fields to order_line_items
ALTER TABLE order_line_items 
ADD COLUMN IF NOT EXISTS selected_bottle_id UUID,
ADD COLUMN IF NOT EXISTS selected_cap_id UUID,
ADD COLUMN IF NOT EXISTS selected_label_id UUID;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_line_items_selected_bottle ON order_line_items(selected_bottle_id);
CREATE INDEX IF NOT EXISTS idx_order_line_items_selected_cap ON order_line_items(selected_cap_id);
CREATE INDEX IF NOT EXISTS idx_order_line_items_selected_label ON order_line_items(selected_label_id);

COMMENT ON COLUMN order_line_items.selected_bottle_id IS 'Specific bottle packaging item selected for this line item';
COMMENT ON COLUMN order_line_items.selected_cap_id IS 'Specific cap packaging item selected for this line item';
COMMENT ON COLUMN order_line_items.selected_label_id IS 'Specific label inventory item selected for this line item';