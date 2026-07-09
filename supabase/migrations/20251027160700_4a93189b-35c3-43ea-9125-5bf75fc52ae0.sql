-- Add customer relationships to formulas, packaging items, and label inventory

-- 1. Add customer_id to formulas table
ALTER TABLE formulas 
ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX idx_formulas_customer_id ON formulas(customer_id);

COMMENT ON COLUMN formulas.customer_id IS 
'Optional customer who owns this formula. NULL means internal/generic formula.';

-- 2. Add customer_id to packaging_item table
ALTER TABLE packaging_item 
ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX idx_packaging_item_customer_id ON packaging_item(customer_id);

COMMENT ON COLUMN packaging_item.customer_id IS 
'Optional customer who uses this packaging. NULL means generic/shared packaging.';

-- 3. Add customer_id and product_name to label_inventory table
ALTER TABLE label_inventory 
ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
ADD COLUMN product_name TEXT;

CREATE INDEX idx_label_inventory_customer_id ON label_inventory(customer_id);

COMMENT ON COLUMN label_inventory.customer_id IS 
'Customer who owns these labels.';
COMMENT ON COLUMN label_inventory.product_name IS 
'Product name for these labels (separates customer from product).';

-- Keep customer_product for backward compatibility during transition