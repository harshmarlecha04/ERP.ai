-- Create office supplies table
CREATE TABLE IF NOT EXISTS public.office_supplies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  quantity_on_hand NUMERIC NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL DEFAULT 'units',
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  shipping_cost NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  last_order_date DATE,
  min_quantity NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create office supply requests table
CREATE TABLE IF NOT EXISTS public.office_supply_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.office_supplies(id),
  item_name TEXT NOT NULL,
  quantity_requested NUMERIC NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  reason TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  fulfilled_by UUID REFERENCES auth.users(id),
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create office supply transactions table for history tracking
CREATE TABLE IF NOT EXISTS public.office_supply_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.office_supplies(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'adjustment')),
  quantity NUMERIC NOT NULL,
  cost NUMERIC DEFAULT 0,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
DO $rls$ BEGIN ALTER TABLE public.office_supplies ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $rls$ BEGIN ALTER TABLE public.office_supply_requests ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $rls$ BEGIN ALTER TABLE public.office_supply_transactions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- RLS Policies for office_supplies
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view office supplies" ON public.office_supplies; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can view office supplies"
  ON public.office_supplies FOR SELECT
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can create office supplies" ON public.office_supplies; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can create office supplies"
  ON public.office_supplies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update office supplies" ON public.office_supplies; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can update office supplies"
  ON public.office_supplies FOR UPDATE
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete office supplies" ON public.office_supplies; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can delete office supplies"
  ON public.office_supplies FOR DELETE
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- RLS Policies for office_supply_requests
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view requests" ON public.office_supply_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can view requests"
  ON public.office_supply_requests FOR SELECT
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can create requests" ON public.office_supply_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can create requests"
  ON public.office_supply_requests FOR INSERT
  WITH CHECK (auth.uid() = requested_by); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update their own or all requests" ON public.office_supply_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can update their own or all requests"
  ON public.office_supply_requests FOR UPDATE
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete requests" ON public.office_supply_requests; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can delete requests"
  ON public.office_supply_requests FOR DELETE
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- RLS Policies for office_supply_transactions
DO $pol$ BEGIN DROP POLICY IF EXISTS "All authenticated users can view transactions" ON public.office_supply_transactions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "All authenticated users can view transactions"
  ON public.office_supply_transactions FOR SELECT
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can create transactions" ON public.office_supply_transactions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can create transactions"
  ON public.office_supply_transactions FOR INSERT
  WITH CHECK (auth.uid() = performed_by); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_office_supplies_category ON public.office_supplies(category);
CREATE INDEX IF NOT EXISTS idx_office_supply_requests_status ON public.office_supply_requests(status);
CREATE INDEX IF NOT EXISTS idx_office_supply_requests_requested_by ON public.office_supply_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_office_supply_transactions_item_id ON public.office_supply_transactions(item_id);

-- Create trigger to update updated_at timestamp
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='update_updated_at_column' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_office_supplies_updated_at ON public.office_supplies;
CREATE TRIGGER update_office_supplies_updated_at
  BEFORE UPDATE ON public.office_supplies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_office_supply_requests_updated_at ON public.office_supply_requests;
CREATE TRIGGER update_office_supply_requests_updated_at
  BEFORE UPDATE ON public.office_supply_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();