-- Update formulas table to use granular, per-formula permissions

-- Drop the broad role-based access policy
DROP POLICY IF EXISTS "Only authorized personnel can view formulas" ON public.formulas;
DROP POLICY IF EXISTS "Only R&D and admin can create formulas" ON public.formulas;
DROP POLICY IF EXISTS "Only R&D and admin can update formulas" ON public.formulas;

-- Implement granular access control - users only see formulas they're explicitly granted access to
CREATE POLICY "Granular formula access control"
ON public.formulas
FOR SELECT
TO authenticated
USING (
  (NOT is_deleted) AND (
    -- Admin override for management purposes
    has_role(auth.uid(), 'admin'::app_role) OR
    -- Explicit formula-specific permission required
    EXISTS (
      SELECT 1 FROM public.formula_user_permissions fup
      WHERE fup.formula_id = formulas.id 
      AND fup.user_id = auth.uid()
      AND fup.is_active = true
      AND (fup.expires_at IS NULL OR fup.expires_at > now())
    )
  )
);

-- Only admins can create new formulas (they can then grant specific access)
CREATE POLICY "Only admins can create formulas"
ON public.formulas
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can only update formulas they have explicit permission for
CREATE POLICY "Granular formula update control"
ON public.formulas
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.formula_user_permissions fup
    WHERE fup.formula_id = formulas.id 
    AND fup.user_id = auth.uid()
    AND fup.permission_type IN ('edit', 'admin')
    AND fup.is_active = true
    AND (fup.expires_at IS NULL OR fup.expires_at > now())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.formula_user_permissions fup
    WHERE fup.formula_id = formulas.id 
    AND fup.user_id = auth.uid()
    AND fup.permission_type IN ('edit', 'admin')
    AND fup.is_active = true
    AND (fup.expires_at IS NULL OR fup.expires_at > now())
  )
);