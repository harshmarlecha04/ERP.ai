
-- Fix production schedule items with total_required_kg = 0
-- Calculate correct total based on formula batch size and number of batches
UPDATE production_schedule_items psi
SET total_required_kg = psi.batches * f.default_batch_size_kg,
    updated_at = now()
FROM formulas f
WHERE psi.formula_id = f.id
  AND psi.total_required_kg = 0;
