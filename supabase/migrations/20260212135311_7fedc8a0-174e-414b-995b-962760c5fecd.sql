
-- Fix mutable search_path on custom functions

-- 1. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. update_milestone_updated_at
CREATE OR REPLACE FUNCTION public.update_milestone_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. update_office_supply_purchases_updated_at
CREATE OR REPLACE FUNCTION public.update_office_supply_purchases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 4. update_order_fulfillment
CREATE OR REPLACE FUNCTION public.update_order_fulfillment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.order_headers
  SET
    total_bottles_shipped = COALESCE((
      SELECT SUM(bottles_shipped) FROM public.order_line_items WHERE order_id = NEW.order_id
    ), 0),
    updated_at = now()
  WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 5. log_user_activity
CREATE OR REPLACE FUNCTION public.log_user_activity()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 6. trigger_cleanup_expired_sessions
CREATE OR REPLACE FUNCTION public.trigger_cleanup_expired_sessions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.hr_sensitive_data_sessions
  SET is_active = false, terminated_at = now(), terminated_reason = 'expired'
  WHERE is_active = true AND expires_at < now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 7. generate_project_number
CREATE OR REPLACE FUNCTION public.generate_project_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(project_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.projects;
  NEW.project_number := 'PRJ-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 8. fn_create_schedule_item (need to check signature)
-- 9. convert_rd_to_production (need to check signature)
-- We'll handle these two separately if they have parameters

-- Fix overly permissive RLS policy on rd_project_actives
DROP POLICY IF EXISTS "All users can insert rd_project_actives" ON public.rd_project_actives;
CREATE POLICY "Authenticated users can insert rd_project_actives"
ON public.rd_project_actives
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Note: customer_inquiries, inquiry_messages, inquiry_order_details INSERT policies
-- are intentionally open for the public inquiry submission form (unauthenticated users).
-- These are correct as-is for the business requirement.
