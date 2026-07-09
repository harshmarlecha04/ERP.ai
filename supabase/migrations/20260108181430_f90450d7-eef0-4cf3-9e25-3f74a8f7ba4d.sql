-- Add display_order column for same-date reordering
ALTER TABLE production_schedule_items 
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Backfill existing items: order by created_at within each schedule_id
WITH ordered AS (
  SELECT id, schedule_id,
         ROW_NUMBER() OVER (PARTITION BY schedule_id ORDER BY created_at) as rn
  FROM production_schedule_items
)
UPDATE production_schedule_items psi
SET display_order = ordered.rn
FROM ordered
WHERE psi.id = ordered.id;