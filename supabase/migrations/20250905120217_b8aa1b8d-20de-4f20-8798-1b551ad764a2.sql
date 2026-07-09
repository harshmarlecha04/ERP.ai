-- Ensure purchase_orders table is configured for real-time updates
ALTER TABLE purchase_orders REPLICA IDENTITY FULL;

-- Add the table to the supabase_realtime publication for real-time functionality
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_orders;