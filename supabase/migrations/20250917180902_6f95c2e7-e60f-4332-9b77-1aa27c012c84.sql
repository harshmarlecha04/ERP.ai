-- Re-enable RLS on formulas table now that the core issue is fixed
ALTER TABLE public.formulas ENABLE ROW LEVEL SECURITY;