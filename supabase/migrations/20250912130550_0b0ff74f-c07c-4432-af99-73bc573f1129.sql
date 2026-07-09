-- Update PO #1882 to have correct data from its items
UPDATE public.purchase_orders 
SET 
    quantity = (SELECT quantity FROM public.purchase_order_items WHERE purchase_order_id = purchase_orders.id LIMIT 1),
    uom = (SELECT uom FROM public.purchase_order_items WHERE purchase_order_id = purchase_orders.id LIMIT 1),
    ingredient_name = (SELECT ingredient_name FROM public.purchase_order_items WHERE purchase_order_id = purchase_orders.id LIMIT 1)
WHERE po_number = '1882' AND (quantity = 0 OR ingredient_name IS NULL);

-- Create a function to get purchase orders with their items for the receiving modal
CREATE OR REPLACE FUNCTION public.get_purchase_order_with_items(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Get the main PO data with items
    SELECT jsonb_build_object(
        'id', po.id,
        'po_number', po.po_number,
        'vendor_name', po.vendor_name,
        'ingredient_name', po.ingredient_name,
        'quantity', po.quantity,
        'uom', po.uom,
        'ordered_date', po.ordered_date,
        'expected_delivery', po.expected_delivery,
        'terms', po.terms,
        'invoice_total', po.invoice_total,
        'tracking_number', po.tracking_number,
        'status', po.status,
        'items', COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'id', poi.id,
                    'ingredient_id', poi.ingredient_id,
                    'ingredient_name', poi.ingredient_name,
                    'quantity', poi.quantity,
                    'uom', poi.uom,
                    'unit_cost', poi.unit_cost,
                    'total_cost', poi.total_cost
                )
                ORDER BY poi.created_at
            )
            FROM public.purchase_order_items poi 
            WHERE poi.purchase_order_id = po.id),
            '[]'::jsonb
        )
    ) INTO result
    FROM public.purchase_orders po
    WHERE po.id = p_order_id;
    
    RETURN result;
END;
$$;