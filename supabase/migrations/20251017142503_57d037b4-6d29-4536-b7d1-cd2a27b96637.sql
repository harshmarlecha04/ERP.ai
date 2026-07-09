-- Add number_of_towers column to production_schedule_items table
ALTER TABLE production_schedule_items 
ADD COLUMN IF NOT EXISTS number_of_towers INTEGER;

COMMENT ON COLUMN production_schedule_items.number_of_towers IS 'Number of drying towers used for this production batch';