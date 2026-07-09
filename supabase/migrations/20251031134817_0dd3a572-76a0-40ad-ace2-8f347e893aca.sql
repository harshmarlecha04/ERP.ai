-- Fix search_path for inquiry-related functions
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='generate_inquiry_number' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION generate_inquiry_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  year_part TEXT;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(inquiry_number FROM 'INQ-\d{4}-(\d+)') AS INTEGER)), 0) + 1
  INTO next_num
  FROM customer_inquiries
  WHERE inquiry_number LIKE 'INQ-' || year_part || '-%';
  
  RETURN 'INQ-' || year_part || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$$;

DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='set_inquiry_number' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION set_inquiry_number()
RETURNS TRIGGER
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