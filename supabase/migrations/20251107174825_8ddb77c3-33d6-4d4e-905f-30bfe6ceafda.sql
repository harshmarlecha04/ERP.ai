-- Revamp customers table to separate company and contact information

-- Step 1: Add new columns
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS company_code text,
ADD COLUMN IF NOT EXISTS contact_person text,
ADD COLUMN IF NOT EXISTS contact_title text;

-- Step 2: Migrate existing data (customer_name → company_name, customer_code → company_code)
UPDATE customers 
SET company_name = customer_name,
    company_code = customer_code
WHERE company_name IS NULL;

-- Step 3: Make company_name and company_code required
ALTER TABLE customers 
ALTER COLUMN company_name SET NOT NULL,
ALTER COLUMN company_code SET NOT NULL;

-- Step 4: Add unique constraint on company_code
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_company_code_unique;
ALTER TABLE customers 
ADD CONSTRAINT customers_company_code_unique UNIQUE (company_code);

-- Step 5: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_company_code ON customers(company_code);
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);

-- Step 6: Drop old columns (we've migrated the data)
ALTER TABLE customers 
DROP COLUMN IF EXISTS customer_name,
DROP COLUMN IF EXISTS customer_code;

-- Add comments for clarity
COMMENT ON COLUMN customers.company_name IS 'The business/company name';
COMMENT ON COLUMN customers.company_code IS 'Unique company identifier (e.g., GOT, CBDFX)';
COMMENT ON COLUMN customers.contact_person IS 'Primary contact person name';
COMMENT ON COLUMN customers.contact_title IS 'Contact person job title/position';