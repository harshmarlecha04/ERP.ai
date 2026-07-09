-- Add foreign key constraint for selected_bottle_id to packaging_item
ALTER TABLE production_schedule_items
ADD CONSTRAINT fk_production_schedule_items_bottle
FOREIGN KEY (selected_bottle_id)
REFERENCES packaging_item(id)
ON DELETE SET NULL;