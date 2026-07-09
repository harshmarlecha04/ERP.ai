-- Fix the inquiry number generation function to work with anonymous users
-- The function needs to be SECURITY DEFINER to read from customer_inquiries table

DROP FUNCTION IF EXISTS public.generate_inquiry_number() CASCADE;
DROP FUNCTION IF EXISTS public.set_inquiry_number() CASCADE;

-- Recreate generate_inquiry_number as SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.generate_inquiry_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
  year_prefix text;
  inquiry_num text;
BEGIN
  -- Get current year
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get the highest number for this year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(inquiry_number FROM '\d+$') AS integer
      )
    ),
    0
  ) + 1
  INTO next_number
  FROM customer_inquiries
  WHERE inquiry_number LIKE year_prefix || '-%';
  
  -- Format as YYYY-####
  inquiry_num := year_prefix || '-' || LPAD(next_number::text, 4, '0');
  
  RETURN inquiry_num;
END;
$$;

-- Recreate set_inquiry_number as SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.set_inquiry_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.inquiry_number IS NULL OR NEW.inquiry_number = '' THEN
    NEW.inquiry_number := generate_inquiry_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS set_inquiry_number_trigger ON customer_inquiries;
CREATE TRIGGER set_inquiry_number_trigger
  BEFORE INSERT ON customer_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION set_inquiry_number();