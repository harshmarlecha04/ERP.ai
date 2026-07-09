-- Fix Security Linter Warnings
-- This migration addresses the security warnings detected by the linter

-- Fix 1: Set search_path for functions that don't have it set (Function Search Path Mutable)
-- Update existing functions to have proper search_path

CREATE OR REPLACE FUNCTION public.assign_first_user_as_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Only assign admin if no admin exists yet
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
        INSERT INTO public.user_roles (user_id, role, granted_by, granted_at)
        VALUES (NEW.id, 'admin', NEW.id, now());
        
        RAISE NOTICE 'First user assigned admin role: %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_inventory_lots()
RETURNS TABLE(id uuid, ingredient_id uuid, ingredient_name text, qty_on_hand_kg numeric, qty_reserved_kg numeric, created_at timestamp with time zone)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT 
    rml.id,
    rml.raw_material_id as ingredient_id,
    rm.name as ingredient_name,
    rml.quantity as qty_on_hand_kg,
    rml.qty_reserved_kg,
    rml.created_at
  FROM public.raw_material_lots rml
  JOIN public.raw_materials rm ON rm.id = rml.raw_material_id;
$$;

CREATE OR REPLACE FUNCTION public.fn_formula_requirements(p_formula_id uuid, p_batches integer)
RETURNS TABLE(ingredient_id uuid, ingredient_name text, required_kg numeric)
LANGUAGE sql
SET search_path TO 'public'
AS $$
  SELECT
    (rec.ingredient_id)::uuid as ingredient_id,
    rec.ingredient_name::text as ingredient_name,
    (rec.qty_per_batch_kg::numeric * p_batches)::numeric as required_kg
  FROM (
    SELECT * FROM jsonb_to_recordset(
      COALESCE((SELECT recipe_json FROM public.formulas f WHERE f.id = p_formula_id), '[]'::jsonb)
    ) AS x(ingredient_id text, ingredient_name text, qty_per_batch_kg numeric)
  ) rec;
$$;

-- Note: The other warnings (Extension in Public, Auth OTP long expiry, Leaked Password Protection)
-- are configuration-level warnings that need to be addressed in the Supabase dashboard settings
-- rather than through SQL migrations. These are noted for the user to address manually.