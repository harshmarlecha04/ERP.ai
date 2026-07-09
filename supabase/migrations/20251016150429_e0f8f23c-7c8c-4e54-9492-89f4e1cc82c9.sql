-- Fix the remaining security definer view
DROP VIEW IF EXISTS public.v_material_usage_trends;
CREATE OR REPLACE VIEW public.v_material_usage_trends
WITH (security_invoker = true)
AS
SELECT 
    id.raw_material_id,
    rm.code AS material_code,
    rm.name AS material_name,
    date_trunc('month', cbd.completed_at) AS usage_month,
    sum(id.deducted_quantity_kg) AS total_used_kg,
    count(DISTINCT cbd.id) AS batch_count,
    avg(id.deducted_quantity_kg) AS avg_per_batch
FROM ingredient_deductions id
JOIN completed_batch_deductions cbd ON cbd.id = id.completed_batch_id
JOIN raw_materials rm ON rm.id = id.raw_material_id
GROUP BY id.raw_material_id, rm.code, rm.name, date_trunc('month', cbd.completed_at);