-- ========================================
-- FIX: Security Definer Views
-- ========================================
-- This migration fixes views that were using SECURITY DEFINER (or defaulting to it)
-- by explicitly setting them to SECURITY INVOKER, which is more secure.
--
-- SECURITY INVOKER means the view executes with the permissions of the querying user,
-- rather than the view creator, preventing privilege escalation.

-- Fix v_packaging_balances view
-- This view shows current packaging inventory balances
DROP VIEW IF EXISTS public.v_packaging_balances CASCADE;

CREATE OR REPLACE VIEW public.v_packaging_balances
WITH (security_invoker = true)
AS
SELECT 
  i.id AS item_id,
  i.category,
  i.item_name,
  i.description,
  i.sku,
  i.uom,
  i.location,
  i.min_level,
  i.notes,
  COALESCE(SUM(m.qty), 0::numeric) AS on_hand,
  i.created_at,
  i.updated_at
FROM packaging_item i
LEFT JOIN packaging_movement m ON m.item_id = i.id
GROUP BY i.id, i.category, i.item_name, i.description, i.sku, i.uom, i.location, i.min_level, i.notes, i.created_at, i.updated_at;

-- Fix v_packaging_history view
-- This view shows packaging movement history
DROP VIEW IF EXISTS public.v_packaging_history CASCADE;

CREATE OR REPLACE VIEW public.v_packaging_history
WITH (security_invoker = true)
AS
SELECT 
  m.id,
  m.item_id,
  i.category,
  i.item_name,
  m.move_date,
  m.move_type,
  m.qty,
  m.po,
  m.vendor,
  COALESCE(m.location, i.location) AS location,
  m.notes,
  m.created_at
FROM packaging_movement m
JOIN packaging_item i ON i.id = m.item_id
ORDER BY m.move_date DESC, m.created_at DESC;

-- Note: These views now execute with the querying user's permissions
-- Make sure RLS policies on underlying tables (packaging_item, packaging_movement) 
-- are properly configured to control access