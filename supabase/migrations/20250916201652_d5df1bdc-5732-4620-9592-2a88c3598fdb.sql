-- Fix security issues by recreating views with proper security definer
DROP VIEW IF EXISTS public.v_packaging_balances;
DROP VIEW IF EXISTS public.v_packaging_history;

-- Recreate views without security definer (using invoker rights by default)
CREATE OR REPLACE VIEW public.v_packaging_balances AS
SELECT
    i.id as item_id,
    i.category,
    i.item_name,
    i.description,
    i.sku,
    i.uom,
    i.location,
    i.min_level,
    i.notes,
    COALESCE(SUM(m.qty), 0) AS on_hand,
    i.created_at,
    i.updated_at
FROM public.packaging_item i
LEFT JOIN public.packaging_movement m ON m.item_id = i.id
GROUP BY i.id, i.category, i.item_name, i.description, i.sku, i.uom, i.location, i.min_level, i.notes, i.created_at, i.updated_at;

CREATE OR REPLACE VIEW public.v_packaging_history AS
SELECT
    m.id,
    m.item_id,
    i.category,
    i.item_name,
    m.move_date,
    m.move_type,
    m.qty,
    m.po,
    m.vendor,
    COALESCE(m.location, i.location) AS location,
    m.notes,
    m.created_at
FROM public.packaging_movement m
JOIN public.packaging_item i ON i.id = m.item_id
ORDER BY m.move_date DESC, m.created_at DESC;

-- Update function with proper search_path
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='update_packaging_item_updated_at' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.update_packaging_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;