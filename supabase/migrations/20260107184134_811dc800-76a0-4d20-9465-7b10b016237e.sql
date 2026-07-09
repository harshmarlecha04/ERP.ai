-- Add foreign key constraint for selected_bottle_id to packaging_item
ALTER TABLE order_line_items 
ADD CONSTRAINT fk_order_line_items_selected_bottle 
FOREIGN KEY (selected_bottle_id) 
REFERENCES packaging_item(id) 
ON DELETE SET NULL;

-- Add foreign key constraint for selected_cap_id to packaging_item
ALTER TABLE order_line_items 
ADD CONSTRAINT fk_order_line_items_selected_cap 
FOREIGN KEY (selected_cap_id) 
REFERENCES packaging_item(id) 
ON DELETE SET NULL;

-- Add foreign key constraint for selected_label_id to label_inventory
ALTER TABLE order_line_items 
ADD CONSTRAINT fk_order_line_items_selected_label 
FOREIGN KEY (selected_label_id) 
REFERENCES label_inventory(id) 
ON DELETE SET NULL;