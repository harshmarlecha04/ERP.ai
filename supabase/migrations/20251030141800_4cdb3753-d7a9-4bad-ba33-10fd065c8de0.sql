-- Drop existing foreign key constraint
ALTER TABLE office_supply_requests 
DROP CONSTRAINT IF EXISTS office_supply_requests_item_id_fkey;

-- Recreate with CASCADE delete
ALTER TABLE office_supply_requests DROP CONSTRAINT IF EXISTS office_supply_requests_item_id_fkey;
ALTER TABLE office_supply_requests 
ADD CONSTRAINT office_supply_requests_item_id_fkey 
FOREIGN KEY (item_id) 
REFERENCES office_supplies(id) 
ON DELETE CASCADE;

-- Also cascade delete for transactions
ALTER TABLE office_supply_transactions 
DROP CONSTRAINT IF EXISTS office_supply_transactions_item_id_fkey;

ALTER TABLE office_supply_transactions DROP CONSTRAINT IF EXISTS office_supply_transactions_item_id_fkey;
ALTER TABLE office_supply_transactions 
ADD CONSTRAINT office_supply_transactions_item_id_fkey 
FOREIGN KEY (item_id) 
REFERENCES office_supplies(id) 
ON DELETE CASCADE;