-- Create customer inquiries table
CREATE TABLE IF NOT EXISTS public.customer_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  company_name TEXT,
  inquiry_type TEXT NOT NULL CHECK (inquiry_type IN ('new_order', 'order_status', 'product_question', 'pricing', 'general')),
  related_order_id UUID REFERENCES public.order_headers(id),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'responded', 'converted_to_order', 'closed')),
  assigned_to UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Create inquiry messages table for conversation threads
CREATE TABLE IF NOT EXISTS public.inquiry_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.customer_inquiries(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'staff')),
  sender_id UUID REFERENCES public.profiles(id),
  sender_name TEXT NOT NULL,
  sender_email TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_internal_note BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create inquiry order details table for new order inquiries
CREATE TABLE IF NOT EXISTS public.inquiry_order_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.customer_inquiries(id) ON DELETE CASCADE,
  product_name TEXT,
  formula_code TEXT,
  quantity INTEGER,
  bottle_size INTEGER,
  preferred_delivery_date DATE,
  special_requirements TEXT,
  order_type TEXT CHECK (order_type IN ('production', 'rd_sample', 'rd_development')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create function to generate inquiry numbers
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='generate_inquiry_number' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION generate_inquiry_number()
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate inquiry numbers
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='set_inquiry_number' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION set_inquiry_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inquiry_number IS NULL OR NEW.inquiry_number = '' THEN
    NEW.inquiry_number := generate_inquiry_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_inquiry_number ON customer_inquiries;
CREATE TRIGGER trigger_set_inquiry_number
BEFORE INSERT ON customer_inquiries
FOR EACH ROW
EXECUTE FUNCTION set_inquiry_number();

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_customer_inquiries_updated_at ON customer_inquiries;
CREATE TRIGGER update_customer_inquiries_updated_at
BEFORE UPDATE ON customer_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
DO $rls$ BEGIN ALTER TABLE public.customer_inquiries ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $rls$ BEGIN ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $rls$ BEGIN ALTER TABLE public.inquiry_order_details ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- RLS Policies for customer_inquiries
DO $pol$ BEGIN DROP POLICY IF EXISTS "Anyone can submit inquiries" ON public.customer_inquiries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Anyone can submit inquiries"
ON public.customer_inquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view all inquiries" ON public.customer_inquiries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view all inquiries"
ON public.customer_inquiries
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update inquiries" ON public.customer_inquiries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can update inquiries"
ON public.customer_inquiries
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete inquiries" ON public.customer_inquiries; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can delete inquiries"
ON public.customer_inquiries
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- RLS Policies for inquiry_messages
DO $pol$ BEGIN DROP POLICY IF EXISTS "Anyone can insert inquiry messages" ON public.inquiry_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Anyone can insert inquiry messages"
ON public.inquiry_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view inquiry messages" ON public.inquiry_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view inquiry messages"
ON public.inquiry_messages
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update inquiry messages" ON public.inquiry_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can update inquiry messages"
ON public.inquiry_messages
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete inquiry messages" ON public.inquiry_messages; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can delete inquiry messages"
ON public.inquiry_messages
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- RLS Policies for inquiry_order_details
DO $pol$ BEGIN DROP POLICY IF EXISTS "Anyone can insert inquiry order details" ON public.inquiry_order_details; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Anyone can insert inquiry order details"
ON public.inquiry_order_details
FOR INSERT
TO anon, authenticated
WITH CHECK (true); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view inquiry order details" ON public.inquiry_order_details; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view inquiry order details"
ON public.inquiry_order_details
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update inquiry order details" ON public.inquiry_order_details; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can update inquiry order details"
ON public.inquiry_order_details
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete inquiry order details" ON public.inquiry_order_details; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can delete inquiry order details"
ON public.inquiry_order_details
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_status ON customer_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_type ON customer_inquiries(inquiry_type);
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_customer_email ON customer_inquiries(customer_email);
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_created_at ON customer_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry_id ON inquiry_messages(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_order_details_inquiry_id ON inquiry_order_details(inquiry_id);