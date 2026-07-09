-- =====================================================
-- SECURITY FIXES MIGRATION (Part 2)
-- =====================================================

-- Add performance indexes on frequently queried columns that exist

CREATE INDEX IF NOT EXISTS idx_raw_materials_is_archived ON raw_materials(is_archived);
CREATE INDEX IF NOT EXISTS idx_raw_materials_supplier ON raw_materials(supplier);
CREATE INDEX IF NOT EXISTS idx_formulas_status ON formulas(status);
CREATE INDEX IF NOT EXISTS idx_formulas_security_level ON formulas(security_level);
CREATE INDEX IF NOT EXISTS idx_production_schedule_items_current_stage ON production_schedule_items(current_stage);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_order_headers_status ON order_headers(status);
CREATE INDEX IF NOT EXISTS idx_order_headers_due_date ON order_headers(due_date);