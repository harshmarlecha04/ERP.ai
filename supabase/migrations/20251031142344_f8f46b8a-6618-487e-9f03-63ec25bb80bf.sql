-- Make inquiry_number nullable to avoid RLS timing issues
-- The trigger will always set the value, so we don't need NOT NULL constraint
ALTER TABLE customer_inquiries 
ALTER COLUMN inquiry_number DROP NOT NULL;