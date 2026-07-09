-- Drop the view first
DROP VIEW IF EXISTS v_packaging_balances;

-- Rename column from packable_bottles to bottles_per_unit
DO $rn$ BEGIN ALTER TABLE packaging_item 
RENAME COLUMN packable_bottles TO bottles_per_unit; EXCEPTION WHEN undefined_column OR duplicate_column OR undefined_table THEN NULL; END $rn$;

-- Set default value
ALTER TABLE packaging_item 
ALTER COLUMN bottles_per_unit SET DEFAULT 1;

-- Update existing data with sensible defaults
UPDATE packaging_item 
SET bottles_per_unit = 24 
WHERE category IN ('BOTTLES', 'CORRUGATED');

UPDATE packaging_item 
SET bottles_per_unit = 1 
WHERE bottles_per_unit = 0 OR bottles_per_unit IS NULL;

-- Recreate the view with calculation
CREATE OR REPLACE VIEW v_packaging_balances AS
SELECT 
  pi.id AS item_id,
  pi.category,
  pi.item_name,
  pi.description,
  pi.sku,
  pi.uom,
  pi.location,
  pi.min_level,
  pi.notes,
  pi.bottles_per_unit,
  COALESCE(SUM(
    CASE 
      WHEN pm.move_type IN ('RECEIPT', 'ADJUSTMENT', 'RETURN') THEN pm.qty
      WHEN pm.move_type = 'USAGE' THEN -pm.qty
      ELSE 0
    END
  ), 0) AS on_hand,
  COALESCE(SUM(
    CASE 
      WHEN pm.move_type IN ('RECEIPT', 'ADJUSTMENT', 'RETURN') THEN pm.qty
      WHEN pm.move_type = 'USAGE' THEN -pm.qty
      ELSE 0
    END
  ), 0) * pi.bottles_per_unit AS packable_bottles,
  pi.created_at,
  pi.updated_at
FROM packaging_item pi
LEFT JOIN packaging_movement pm ON pm.item_id = pi.id
GROUP BY pi.id;