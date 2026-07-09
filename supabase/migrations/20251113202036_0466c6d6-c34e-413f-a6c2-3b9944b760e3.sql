-- Function to update order header totals
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for INSERT
CREATE TRIGGER trg_order_line_items_totals_insert
AFTER INSERT ON order_line_items
FOR EACH ROW
EXECUTE FUNCTION update_order_header_totals();

-- Create trigger for UPDATE
CREATE TRIGGER trg_order_line_items_totals_update
AFTER UPDATE ON order_line_items
FOR EACH ROW
EXECUTE FUNCTION update_order_header_totals();

-- Create trigger for DELETE
CREATE TRIGGER trg_order_line_items_totals_delete
AFTER DELETE ON order_line_items
FOR EACH ROW
EXECUTE FUNCTION update_order_header_totals();

-- Fix existing data by updating all order headers
UPDATE order_headers oh
SET 
  total_line_items = (
    SELECT COUNT(*)
    FROM order_line_items oli
    WHERE oli.order_id = oh.id
  ),
  total_bottles_ordered = (
    SELECT COALESCE(SUM(bottles_ordered), 0)
    FROM order_line_items oli
    WHERE oli.order_id = oh.id
  ),
  total_bottles_shipped = (
    SELECT COALESCE(SUM(bottles_shipped), 0)
    FROM order_line_items oli
    WHERE oli.order_id = oh.id
  );