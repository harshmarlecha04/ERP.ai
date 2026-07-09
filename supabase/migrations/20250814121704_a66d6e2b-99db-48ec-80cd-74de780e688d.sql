-- Security Fix: Set proper search_path for all functions to prevent injection attacks

-- Fix function search paths to be secure
ALTER FUNCTION public.assign_first_user_as_admin() SET search_path = 'public';
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
ALTER FUNCTION public.get_inventory_lots() SET search_path = 'public';
ALTER FUNCTION public.fn_upsert_schedule(date) SET search_path = 'public';
ALTER FUNCTION public.fn_create_schedule_item(date, uuid, integer) SET search_path = 'public';
ALTER FUNCTION public.fn_formula_requirements(uuid, integer) SET search_path = 'public';
ALTER FUNCTION public.fn_check_materials(uuid, integer, date, uuid) SET search_path = 'public';
ALTER FUNCTION public.fn_reserve_materials(uuid) SET search_path = 'public';
ALTER FUNCTION public.fn_move_item_and_recheck(uuid, date) SET search_path = 'public';
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = 'public';
ALTER FUNCTION public.can_access_formulas(uuid) SET search_path = 'public';
ALTER FUNCTION public.assign_initial_admin() SET search_path = 'public';
ALTER FUNCTION public.can_access_specific_formula(uuid, uuid, text) SET search_path = 'public';
ALTER FUNCTION public.log_formula_access(uuid, uuid, text, jsonb) SET search_path = 'public';
ALTER FUNCTION public.grant_formula_access(uuid, uuid, text, text, timestamp with time zone) SET search_path = 'public';