-- Add packaging selection columns to production_schedule_items
ALTER TABLE production_schedule_items 
ADD COLUMN IF NOT EXISTS selected_bottle_id uuid,
ADD COLUMN IF NOT EXISTS selected_cap_id uuid,
ADD COLUMN IF NOT EXISTS selected_label_id uuid,
ADD COLUMN IF NOT EXISTS selected_corrugated_id uuid,
ADD COLUMN IF NOT EXISTS estimated_bottles integer;

-- Add comments for documentation
COMMENT ON COLUMN production_schedule_items.selected_bottle_id IS 'Reference to packaging_items for bottle type';
COMMENT ON COLUMN production_schedule_items.selected_cap_id IS 'Reference to packaging_items for cap type';
COMMENT ON COLUMN production_schedule_items.selected_label_id IS 'Reference to label_inventory for label';
COMMENT ON COLUMN production_schedule_items.selected_corrugated_id IS 'Reference to packaging_items for corrugated box';
COMMENT ON COLUMN production_schedule_items.estimated_bottles IS 'Estimated number of bottles this batch will produce';