-- Add packable_bottles column to packaging_movement table
ALTER TABLE packaging_movement 
ADD COLUMN IF NOT EXISTS packable_bottles numeric;

-- Add packable_bottles column to packaging_item table to track total
ALTER TABLE packaging_item
ADD COLUMN IF NOT EXISTS packable_bottles numeric DEFAULT 0;

-- Create or replace view to include packable bottles in balances
DROP VIEW IF EXISTS v_packaging_balances;

CREATE OR REPLACE VIEW v_packaging_balances AS
SELECT 
  pi.id as item_id,
  pi.category,
  pi.item_name,
  pi.description,
  pi.sku,
  pi.uom,
  pi.location,
  pi.min_level,
  pi.notes,
  pi.created_at,
  pi.updated_at,
  COALESCE(SUM(pm.qty), 0) as on_hand,
  COALESCE(SUM(pm.packable_bottles), 0) as packable_bottles
FROM packaging_item pi
LEFT JOIN packaging_movement pm ON pi.id = pm.item_id
GROUP BY pi.id, pi.category, pi.item_name, pi.description, pi.sku, 
         pi.uom, pi.location, pi.min_level, pi.notes, pi.created_at, pi.updated_at;