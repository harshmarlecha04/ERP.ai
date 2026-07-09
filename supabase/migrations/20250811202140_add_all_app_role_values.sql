-- Ensure every app_role value used anywhere in later migrations exists.
-- (Added during replay verification; ADD VALUE IF NOT EXISTS is a no-op when present.)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'quality_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'rd_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'formulation_scientist';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'procurement';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'member';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
