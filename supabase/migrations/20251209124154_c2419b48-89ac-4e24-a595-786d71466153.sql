-- Add buy_link column to office_supplies table
ALTER TABLE office_supplies ADD COLUMN IF NOT EXISTS buy_link TEXT;

-- Add buy_link column to office_supply_requests table
ALTER TABLE office_supply_requests ADD COLUMN IF NOT EXISTS buy_link TEXT;