
-- Approval columns
ALTER TABLE public.order_headers
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Submit PO for approval: customer portal calls this after creating the order.
CREATE OR REPLACE FUNCTION public.submit_po_for_approval(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _approvers text[] := ARRAY['mfg@pharmvista.com','bizops@pharmvista.com','licensing@pharmvista.com','sales@pharmvista.com'];
  _header record;
  _customer_name text;
  _approver_id uuid;
  _email text;
BEGIN
  SELECT * INTO _header FROM public.order_headers WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  UPDATE public.order_headers
    SET approval_status = 'pending'
    WHERE id = _order_id;

  SELECT company_name INTO _customer_name FROM public.customers WHERE id = _header.customer_id;

  FOREACH _email IN ARRAY _approvers LOOP
    SELECT id INTO _approver_id FROM public.profiles WHERE lower(email) = lower(_email) LIMIT 1;
    IF _approver_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, action_required, action_url, data)
      VALUES (
        _approver_id,
        'po_approval',
        'New PO awaiting approval — ' || COALESCE(_header.po_number, _header.order_number),
        COALESCE(_customer_name, 'Customer') || ' submitted a purchase order for review.',
        true,
        '/orders/' || _order_id::text || '/approve',
        jsonb_build_object(
          'order_id', _order_id,
          'po_number', _header.po_number,
          'order_number', _header.order_number,
          'customer_name', _customer_name
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- Decide PO approval: approve or reject. Optional formula assignments per line.
CREATE OR REPLACE FUNCTION public.decide_po_approval(
  _order_id uuid,
  _decision text,
  _rejection_reason text DEFAULT NULL,
  _line_formulas jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _approvers text[] := ARRAY['mfg@pharmvista.com','bizops@pharmvista.com','licensing@pharmvista.com','sales@pharmvista.com'];
  _email text;
  _uid uuid := auth.uid();
  _header record;
  _customer_user_id uuid;
  _line_id text;
  _formula_id text;
BEGIN
  SELECT lower(email) INTO _email FROM public.profiles WHERE id = _uid;
  IF NOT (public.has_role(_uid, 'admin') OR _email = ANY(_approvers)) THEN
    RAISE EXCEPTION 'Not authorized to approve purchase orders';
  END IF;

  IF _decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Invalid decision: %', _decision;
  END IF;

  SELECT * INTO _header FROM public.order_headers WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF _decision = 'approved' THEN
    UPDATE public.order_headers
      SET approval_status = 'approved', approved_by = _uid, approved_at = now()
      WHERE id = _order_id;

    -- Apply optional formula assignments
    FOR _line_id, _formula_id IN SELECT * FROM jsonb_each_text(_line_formulas) LOOP
      UPDATE public.order_line_items
        SET formula_id = NULLIF(_formula_id,'')::uuid
        WHERE id = _line_id::uuid AND order_id = _order_id;
    END LOOP;
  ELSE
    UPDATE public.order_headers
      SET approval_status = 'rejected', rejected_by = _uid, rejected_at = now(),
          rejection_reason = _rejection_reason
      WHERE id = _order_id;
  END IF;

  -- Mark related approval notifications resolved
  UPDATE public.notifications
    SET action_taken = true, read = true
    WHERE type = 'po_approval' AND (data->>'order_id') = _order_id::text;

  -- Notify customer portal users
  FOR _customer_user_id IN
    SELECT cu.user_id FROM public.customer_users cu WHERE cu.customer_id = _header.customer_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, action_url, data)
    VALUES (
      _customer_user_id,
      'po_decision',
      'Your PO was ' || _decision || ' — ' || COALESCE(_header.po_number, _header.order_number),
      CASE WHEN _decision = 'approved'
        THEN 'Your purchase order has been approved and is being processed.'
        ELSE 'Your purchase order was rejected.' || COALESCE(' Reason: ' || _rejection_reason, '')
      END,
      '/portal/purchase-orders/' || _order_id::text,
      jsonb_build_object('order_id', _order_id, 'decision', _decision)
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_po_for_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_po_approval(uuid, text, text, jsonb) TO authenticated;
