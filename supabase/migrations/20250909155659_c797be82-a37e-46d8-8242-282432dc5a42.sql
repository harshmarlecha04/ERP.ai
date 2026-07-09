-- Create purchase_order_items table for multiple ingredients per PO
CREATE TABLE public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL,
  ingredient_id UUID,
  ingredient_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  uom TEXT DEFAULT 'kg',
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on purchase_order_items
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for purchase_order_items
CREATE POLICY "All users can view purchase order items" 
ON public.purchase_order_items 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All users can manage purchase order items" 
ON public.purchase_order_items 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All users can update purchase order items" 
ON public.purchase_order_items 
FOR UPDATE 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All users can delete purchase order items" 
ON public.purchase_order_items 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Add foreign key constraint (optional, for data integrity)
-- ALTER TABLE public.purchase_order_items ADD CONSTRAINT fk_purchase_order_items_po 
-- FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;

-- Remove single-ingredient columns from purchase_orders (we'll keep them for now to avoid breaking existing data)
-- We'll use the items table as the source of truth for ingredients

-- Create function to get purchase orders with their items
CREATE OR REPLACE FUNCTION public.get_purchase_orders_with_items_and_financial_access()
RETURNS TABLE(
  id UUID,
  vendor_id UUID,
  vendor_name TEXT,
  po_number TEXT,
  ordered_date DATE,
  expected_delivery DATE,
  received_date DATE,
  received_by UUID,
  invoice_total NUMERIC,
  status TEXT,
  terms TEXT,
  tracking_number TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  can_view_financial_data BOOLEAN,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    user_has_financial_access BOOLEAN := FALSE;
BEGIN
    -- Check if user has permission to access financial data
    user_has_financial_access := (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'production_manager'::app_role)
    );
    
    -- Return purchase orders with their items
    RETURN QUERY
    SELECT 
        po.id,
        po.vendor_id,
        po.vendor_name,
        po.po_number,
        po.ordered_date,
        po.expected_delivery,
        po.received_date,
        po.received_by,
        -- Only return financial data if user has proper role
        CASE WHEN user_has_financial_access THEN po.invoice_total ELSE NULL::NUMERIC END as invoice_total,
        po.status,
        po.terms,
        po.tracking_number,
        po.created_by,
        po.created_at,
        po.updated_at,
        user_has_financial_access as can_view_financial_data,
        COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'id', poi.id,
              'ingredient_id', poi.ingredient_id,
              'ingredient_name', poi.ingredient_name,
              'quantity', poi.quantity,
              'uom', poi.uom,
              'unit_cost', CASE WHEN user_has_financial_access THEN poi.unit_cost ELSE NULL::NUMERIC END,
              'total_cost', CASE WHEN user_has_financial_access THEN poi.total_cost ELSE NULL::NUMERIC END
            )
          )
          FROM public.purchase_order_items poi 
          WHERE poi.purchase_order_id = po.id
          ), '[]'::jsonb
        ) as items
    FROM public.purchase_orders po
    ORDER BY po.created_at DESC;
END;
$$;

-- Create function to get purchase order stats with multi-ingredient support
CREATE OR REPLACE FUNCTION public.get_purchase_order_stats_with_items_secure()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    user_has_financial_access BOOLEAN := FALSE;
    total_orders INTEGER := 0;
    pending_orders INTEGER := 0;
    received_orders INTEGER := 0;
    total_value NUMERIC := 0;
    monthly_value NUMERIC := 0;
    result JSONB;
BEGIN
    -- Check if user has permission to access financial data
    user_has_financial_access := (
        has_role(auth.uid(), 'admin'::app_role) OR 
        has_role(auth.uid(), 'production_manager'::app_role)
    );
    
    -- Get basic counts
    SELECT COUNT(*) INTO total_orders FROM public.purchase_orders;
    SELECT COUNT(*) INTO pending_orders FROM public.purchase_orders WHERE status = 'ordered';
    SELECT COUNT(*) INTO received_orders FROM public.purchase_orders WHERE status = 'received';
    
    -- Get financial data only if user has access
    IF user_has_financial_access THEN
        SELECT COALESCE(SUM(invoice_total), 0) INTO total_value FROM public.purchase_orders;
        SELECT COALESCE(SUM(invoice_total), 0) INTO monthly_value 
        FROM public.purchase_orders 
        WHERE ordered_date >= date_trunc('month', CURRENT_DATE);
    END IF;
    
    result := jsonb_build_object(
        'totalOrders', total_orders,
        'pendingOrders', pending_orders,
        'shippedOrders', 0, -- Keep for compatibility
        'deliveredOrders', received_orders,
        'totalValue', total_value,
        'monthlyValue', monthly_value,
        'hasFinancialAccess', user_has_financial_access
    );
    
    RETURN result;
END;
$$;