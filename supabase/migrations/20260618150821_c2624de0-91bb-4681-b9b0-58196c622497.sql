
ALTER TABLE public.raw_materials ADD COLUMN IF NOT EXISTS barcode text;
CREATE UNIQUE INDEX IF NOT EXISTS raw_materials_barcode_uniq ON public.raw_materials(barcode) WHERE barcode IS NOT NULL;

CREATE OR REPLACE FUNCTION public.find_raw_material_by_barcode(_code text)
RETURNS TABLE (
  raw_material_id uuid,
  code text,
  name text,
  supplier text,
  uom text,
  open_po_id uuid,
  open_po_number text,
  open_po_quantity numeric,
  open_po_uom text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rm.id,
    rm.code,
    rm.name,
    rm.supplier,
    rm.uom,
    po.id,
    po.po_number,
    poi.quantity,
    poi.uom
  FROM public.raw_materials rm
  LEFT JOIN LATERAL (
    SELECT p.id, p.po_number
    FROM public.purchase_orders p
    WHERE p.ingredient_id = rm.id
      AND COALESCE(p.status,'') NOT IN ('received','closed','cancelled')
      AND p.received_date IS NULL
    ORDER BY p.expected_delivery NULLS LAST, p.ordered_date DESC
    LIMIT 1
  ) po ON true
  LEFT JOIN public.purchase_order_items poi
    ON poi.purchase_order_id = po.id AND poi.ingredient_id = rm.id
  WHERE rm.barcode = _code AND COALESCE(rm.is_archived,false) = false
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_raw_material_by_barcode(text) TO authenticated;
