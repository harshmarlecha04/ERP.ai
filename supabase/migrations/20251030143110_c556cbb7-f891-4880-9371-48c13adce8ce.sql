-- Add unit_of_measure column to office_supply_requests table
ALTER TABLE public.office_supply_requests
ADD COLUMN IF NOT EXISTS unit_of_measure text NOT NULL DEFAULT 'units';