-- Disable audit triggers that cause read-only transaction errors
-- These triggers try to INSERT audit logs during SELECT operations,
-- which fails when Supabase uses read replicas

-- Disable audit triggers on formulas table
ALTER TABLE public.formulas DISABLE TRIGGER audit_formulas;
ALTER TABLE public.formulas DISABLE TRIGGER formula_access_monitor;

-- Disable audit triggers on raw_materials table
ALTER TABLE public.raw_materials DISABLE TRIGGER audit_raw_materials;

-- Disable audit triggers on raw_material_lots table
ALTER TABLE public.raw_material_lots DISABLE TRIGGER audit_raw_material_lots;

-- Note: The update_updated_at triggers are fine as they only fire on UPDATE operations
-- Note: inventory_threshold_check_trigger is fine as it only fires on INSERT/UPDATE operations