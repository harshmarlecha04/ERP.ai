-- Fix security warning by setting search_path for the trigger function
CREATE OR REPLACE FUNCTION update_order_header_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the order header with current totals
  UPDATE order_headers
  SET 
    total_line_items = (
      SELECT COUNT(*)
      FROM order_line_items
      WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
    ),
    total_bottles_ordered = (
      SELECT COALESCE(SUM(bottles_ordered), 0)
      FROM order_line_items
      WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
    ),
    total_bottles_shipped = (
      SELECT COALESCE(SUM(bottles_shipped), 0)
      FROM order_line_items
      WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;