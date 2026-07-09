-- Fix Critical Security Issues

-- 1. Fix profiles table constraint to allow 'user' role
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'operator', 'viewer', 'user'));

-- 2. Fix function search path security warnings
-- Update handle_new_user function with immutable search path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'  -- Set immutable search path
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

-- Update other functions with immutable search paths
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'  -- Set immutable search path
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update production-related functions with proper search paths
CREATE OR REPLACE FUNCTION public.fn_upsert_schedule(p_schedule_date date)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = 'public'  -- Set immutable search path
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.production_schedules WHERE schedule_date = p_schedule_date;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.production_schedules(schedule_date)
  VALUES (p_schedule_date)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_formula_requirements(p_formula_id uuid, p_batches integer)
RETURNS TABLE(ingredient_id uuid, ingredient_name text, required_kg numeric)
LANGUAGE sql
SET search_path = 'public'  -- Set immutable search path
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

CREATE OR REPLACE FUNCTION public.fn_check_materials(p_formula_id uuid, p_batches integer, p_schedule_date date, p_exclude_schedule_item_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = 'public'  -- Set immutable search path
AS $$
DECLARE
  v_shortages jsonb := '[]'::jsonb;
  v_ok boolean := true;
  req record;
  v_available numeric;
  v_scheduled numeric;
  v_result jsonb;
BEGIN
  FOR req IN SELECT * FROM public.fn_formula_requirements(p_formula_id, p_batches) LOOP
    SELECT COALESCE(sum(l.quantity - l.qty_reserved_kg), 0) INTO v_available
    FROM public.raw_material_lots l
    WHERE l.raw_material_id = req.ingredient_id;

    SELECT COALESCE(sum((rec.qty_per_batch_kg::numeric) * i.batches), 0) INTO v_scheduled
    FROM public.production_schedule_items i
    JOIN public.production_schedules s ON s.id = i.schedule_id
    JOIN public.formulas f ON f.id = i.formula_id
    CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(f.recipe_json, '[]'::jsonb)) AS rec(ingredient_id text, ingredient_name text, qty_per_batch_kg numeric)
    WHERE s.schedule_date = p_schedule_date
      AND COALESCE(i.materials_ok, false) = true
      AND COALESCE(s.status, 'scheduled') <> 'completed'
      AND (rec.ingredient_id::uuid) = req.ingredient_id
      AND (p_exclude_schedule_item_id IS NULL OR i.id <> p_exclude_schedule_item_id);

    v_available := v_available - v_scheduled;

    IF req.required_kg > v_available THEN
      v_ok := false;
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'ingredient_id', req.ingredient_id,
        'ingredient_name', req.ingredient_name,
        'required_kg', req.required_kg,
        'available_kg', GREATEST(v_available, 0),
        'shortfall_kg', GREATEST(req.required_kg - GREATEST(v_available, 0), 0)
      ));
    END IF;
  END LOOP;

  v_result := jsonb_build_object('materials_ok', v_ok, 'shortages', v_shortages);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_reserve_materials(p_schedule_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = 'public'  -- Set immutable search path
AS $$
DECLARE
  v_item record;
  v_req record;
  v_remaining numeric;
  v_reservations jsonb := '[]'::jsonb;
  v_take numeric;
  v_lot record;
BEGIN
  SELECT i.*, f.recipe_json FROM public.production_schedule_items i
  JOIN public.formulas f ON f.id = i.formula_id
  WHERE i.id = p_schedule_item_id
  INTO v_item;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Schedule item not found';
  END IF;

  FOR v_req IN SELECT * FROM public.fn_formula_requirements(v_item.formula_id, v_item.batches) LOOP
    v_remaining := v_req.required_kg;

    FOR v_lot IN
      SELECT l.* FROM public.raw_material_lots l
      WHERE l.raw_material_id = v_req.ingredient_id
        AND (l.quantity - l.qty_reserved_kg) > 0
      ORDER BY l.created_at ASC, l.id ASC
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, (v_lot.quantity - v_lot.qty_reserved_kg));
      IF v_take > 0 THEN
        UPDATE public.raw_material_lots
          SET qty_reserved_kg = qty_reserved_kg + v_take
          WHERE id = v_lot.id;

        INSERT INTO public.inventory_reservations(schedule_item_id, lot_id, reserved_kg)
        VALUES (p_schedule_item_id, v_lot.id, v_take);

        v_reservations := v_reservations || jsonb_build_array(jsonb_build_object(
          'ingredient_id', v_req.ingredient_id,
          'lot_id', v_lot.id,
          'reserved_kg', v_take
        ));

        v_remaining := v_remaining - v_take;
      END IF;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Insufficient inventory to reserve for ingredient % (remaining % kg)', v_req.ingredient_id, v_remaining;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'reservations', v_reservations);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_create_schedule_item(p_schedule_date date, p_formula_id uuid, p_batches integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = 'public'  -- Set immutable search path
AS $$
DECLARE
  v_check jsonb;
  v_sched_id uuid;
  v_item_id uuid;
  v_total_required numeric;
  v_formula_code text;
  v_res jsonb;
BEGIN
  v_check := public.fn_check_materials(p_formula_id, p_batches, p_schedule_date, null);
  IF COALESCE((v_check->>'materials_ok')::boolean, false) IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'shortages', v_check->'shortages');
  END IF;

  v_sched_id := public.fn_upsert_schedule(p_schedule_date);

  SELECT COALESCE(default_batch_size_kg, 0), formula_code
  INTO v_total_required, v_formula_code
  FROM public.formulas WHERE id = p_formula_id;
  v_total_required := COALESCE(v_total_required, 0) * p_batches;

  INSERT INTO public.production_schedule_items(
    schedule_id, formula_id, formula_code, batches, total_required_kg, materials_ok, shortages_json
  ) VALUES (
    v_sched_id, p_formula_id, v_formula_code, p_batches, v_total_required, true, '[]'::jsonb
  ) RETURNING id INTO v_item_id;

  v_res := public.fn_reserve_materials(v_item_id);

  RETURN jsonb_build_object('ok', true, 'schedule_id', v_sched_id, 'item_id', v_item_id, 'reservations', v_res->'reservations');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_move_item_and_recheck(p_schedule_item_id uuid, p_new_date date)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = 'public'  -- Set immutable search path
AS $$
DECLARE
  v_item record;
  v_check jsonb;
  v_ok boolean;
  v_sched_id uuid;
  v_result jsonb;
BEGIN
  SELECT i.*, f.id AS f_id FROM public.production_schedule_items i
  JOIN public.formulas f ON f.id = i.formula_id
  WHERE i.id = p_schedule_item_id
  INTO v_item;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Schedule item not found';
  END IF;

  v_check := public.fn_check_materials(v_item.formula_id, v_item.batches, p_new_date, p_schedule_item_id);
  v_ok := COALESCE((v_check->>'materials_ok')::boolean, false);

  IF v_ok THEN
    v_sched_id := public.fn_upsert_schedule(p_new_date);
    UPDATE public.production_schedule_items
      SET schedule_id = v_sched_id
      WHERE id = p_schedule_item_id;
    v_result := jsonb_build_object('ok', true, 'schedule_id', v_sched_id);
  ELSE
    v_result := jsonb_build_object('ok', false, 'shortages', v_check->'shortages');
  END IF;

  RETURN v_result;
END;
$$;