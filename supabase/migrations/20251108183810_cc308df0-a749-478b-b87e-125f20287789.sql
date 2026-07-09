-- Fix R&D Project Table RLS Policies
-- Replace overly permissive USING (true) policies with role-based authorization

-- ============================================================
-- Table: rd_projects
-- ============================================================

-- Drop existing overly permissive policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can view rd_projects" ON rd_projects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can insert rd_projects" ON rd_projects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can update rd_projects" ON rd_projects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can delete rd_projects" ON rd_projects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new role-based policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can view rd_projects" ON rd_projects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can view rd_projects"
ON rd_projects FOR SELECT
USING (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can create rd_projects" ON rd_projects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can create rd_projects"
ON rd_projects FOR INSERT
WITH CHECK (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can update rd_projects" ON rd_projects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can update rd_projects"
ON rd_projects FOR UPDATE
USING (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete rd_projects" ON rd_projects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can delete rd_projects"
ON rd_projects FOR DELETE
USING (has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- Table: rd_project_versions
-- ============================================================

-- Drop existing overly permissive policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can view rd_project_versions" ON rd_project_versions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can insert rd_project_versions" ON rd_project_versions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can update rd_project_versions" ON rd_project_versions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can delete rd_project_versions" ON rd_project_versions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new role-based policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can view rd_project_versions" ON rd_project_versions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can view rd_project_versions"
ON rd_project_versions FOR SELECT
USING (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can create rd_project_versions" ON rd_project_versions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can create rd_project_versions"
ON rd_project_versions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can update rd_project_versions" ON rd_project_versions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can update rd_project_versions"
ON rd_project_versions FOR UPDATE
USING (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete rd_project_versions" ON rd_project_versions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can delete rd_project_versions"
ON rd_project_versions FOR DELETE
USING (has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- Table: rd_batch_feedback
-- ============================================================

-- Drop existing overly permissive policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can view rd_batch_feedback" ON rd_batch_feedback; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can insert rd_batch_feedback" ON rd_batch_feedback; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can update rd_batch_feedback" ON rd_batch_feedback; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can delete rd_batch_feedback" ON rd_batch_feedback; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new role-based policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can view rd_batch_feedback" ON rd_batch_feedback; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can view rd_batch_feedback"
ON rd_batch_feedback FOR SELECT
USING (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can create rd_batch_feedback" ON rd_batch_feedback; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can create rd_batch_feedback"
ON rd_batch_feedback FOR INSERT
WITH CHECK (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can update rd_batch_feedback" ON rd_batch_feedback; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can update rd_batch_feedback"
ON rd_batch_feedback FOR UPDATE
USING (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete rd_batch_feedback" ON rd_batch_feedback; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can delete rd_batch_feedback"
ON rd_batch_feedback FOR DELETE
USING (has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- Table: rd_project_batches
-- ============================================================

-- Drop existing overly permissive policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can view rd_project_batches" ON rd_project_batches; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can insert rd_project_batches" ON rd_project_batches; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can update rd_project_batches" ON rd_project_batches; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can delete rd_project_batches" ON rd_project_batches; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new role-based policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can view rd_project_batches" ON rd_project_batches; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can view rd_project_batches"
ON rd_project_batches FOR SELECT
USING (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can create rd_project_batches" ON rd_project_batches; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can create rd_project_batches"
ON rd_project_batches FOR INSERT
WITH CHECK (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can update rd_project_batches" ON rd_project_batches; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can update rd_project_batches"
ON rd_project_batches FOR UPDATE
USING (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete rd_project_batches" ON rd_project_batches; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can delete rd_project_batches"
ON rd_project_batches FOR DELETE
USING (has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- ============================================================
-- Table: rd_version_actives
-- ============================================================

-- Drop existing overly permissive policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can view rd_version_actives" ON rd_version_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can insert rd_version_actives" ON rd_version_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can update rd_version_actives" ON rd_version_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN DROP POLICY IF EXISTS "All users can delete rd_version_actives" ON rd_version_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- Create new role-based policies
DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can view rd_version_actives" ON rd_version_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can view rd_version_actives"
ON rd_version_actives FOR SELECT
USING (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can create rd_version_actives" ON rd_version_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can create rd_version_actives"
ON rd_version_actives FOR INSERT
WITH CHECK (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "RD managers and admins can update rd_version_actives" ON rd_version_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "RD managers and admins can update rd_version_actives"
ON rd_version_actives FOR UPDATE
USING (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'rd_manager') OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can delete rd_version_actives" ON rd_version_actives; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can delete rd_version_actives"
ON rd_version_actives FOR DELETE
USING (has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;