-- Drop existing restrictive policies and create permissive ones for all authenticated users

-- Purchase Orders - Update if not already done
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Only authorized roles can view purchase orders" ON public.purchase_orders;
    DROP POLICY IF EXISTS "Only authorized roles can create purchase orders" ON public.purchase_orders;
    DROP POLICY IF EXISTS "Only authorized roles can update purchase orders" ON public.purchase_orders;
    DROP POLICY IF EXISTS "Only admins can delete purchase orders" ON public.purchase_orders;
    
    -- Only create new policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'purchase_orders' 
        AND policyname = 'All authenticated users can manage purchase orders'
    ) THEN
        CREATE POLICY "All authenticated users can manage purchase orders"
        ON public.purchase_orders
        FOR ALL
        TO authenticated
        USING (auth.uid() IS NOT NULL)
        WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Formulas - Update granular access control
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Granular formula access control" ON public.formulas;
    DROP POLICY IF EXISTS "Granular formula update control" ON public.formulas;
    DROP POLICY IF EXISTS "Only admin can delete formulas" ON public.formulas;
    DROP POLICY IF EXISTS "Only admins can create formulas" ON public.formulas;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'formulas' 
        AND policyname = 'All authenticated users can manage formulas'
    ) THEN
        CREATE POLICY "All authenticated users can manage formulas"
        ON public.formulas
        FOR ALL
        TO authenticated
        USING (auth.uid() IS NOT NULL AND NOT is_deleted)
        WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Formula Ingredients - Remove role restrictions
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Only authorized personnel can view formula ingredients" ON public.formula_ingredients;
    DROP POLICY IF EXISTS "Only R&D and admin can create formula ingredients" ON public.formula_ingredients;
    DROP POLICY IF EXISTS "Only R&D and admin can update formula ingredients" ON public.formula_ingredients;
    DROP POLICY IF EXISTS "Only admin can delete formula ingredients" ON public.formula_ingredients;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'formula_ingredients' 
        AND policyname = 'All authenticated users can manage formula ingredients'
    ) THEN
        CREATE POLICY "All authenticated users can manage formula ingredients"
        ON public.formula_ingredients
        FOR ALL
        TO authenticated
        USING (auth.uid() IS NOT NULL)
        WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Security Config and Alerts - Make viewable by all authenticated users
DO $$ 
BEGIN
    -- Security Config
    DROP POLICY IF EXISTS "Only admins can view security config" ON public.security_config;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'security_config' 
        AND policyname = 'All authenticated users can view security config'
    ) THEN
        CREATE POLICY "All authenticated users can view security config"
        ON public.security_config
        FOR SELECT
        TO authenticated
        USING (auth.uid() IS NOT NULL);
    END IF;
    
    -- Security Alerts
    DROP POLICY IF EXISTS "Only admins can view security alerts" ON public.security_alerts;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'security_alerts' 
        AND policyname = 'All authenticated users can view security alerts'
    ) THEN
        CREATE POLICY "All authenticated users can view security alerts"
        ON public.security_alerts
        FOR SELECT
        TO authenticated
        USING (auth.uid() IS NOT NULL);
    END IF;
END $$;