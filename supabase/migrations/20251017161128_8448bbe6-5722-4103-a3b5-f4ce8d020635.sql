-- Drop the old TEXT-based version of the function to resolve overloading conflict
DROP FUNCTION IF EXISTS public.get_material_requirements_by_date_range(p_start_date TEXT, p_end_date TEXT);