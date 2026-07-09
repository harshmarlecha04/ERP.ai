-- Migrate existing purchase order data to the new multi-ingredient structure
INSERT INTO public.purchase_order_items (
    purchase_order_id,
    ingredient_id,
    ingredient_name,
    quantity,
    uom,
    unit_cost
)
SELECT 
    po.id as purchase_order_id,
    po.ingredient_id,
    po.ingredient_name,
    po.quantity,
    po.uom,
    -- Calculate unit cost from total and quantity if available
    CASE 
        WHEN po.quantity > 0 AND po.invoice_total > 0 
        THEN po.invoice_total / po.quantity 
        ELSE 0 
    END as unit_cost
FROM public.purchase_orders po
WHERE po.ingredient_name IS NOT NULL 
    AND po.ingredient_name != ''
    AND NOT EXISTS (
        SELECT 1 FROM public.purchase_order_items poi 
        WHERE poi.purchase_order_id = po.id
    );