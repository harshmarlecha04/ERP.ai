-- Phase 9 & 10: Database Foundation (Fixed)
-- Report subscriptions for scheduled emails
CREATE TABLE IF NOT EXISTS report_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('weekly_inventory', 'monthly_profitability', 'production_summary')),
  is_active BOOLEAN DEFAULT true,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Demand forecasts table
CREATE TABLE IF NOT EXISTS demand_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID REFERENCES formulas(id) ON DELETE CASCADE,
  forecast_month DATE NOT NULL,
  forecasted_bottles INTEGER NOT NULL,
  forecasted_batches INTEGER NOT NULL,
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  trend TEXT CHECK (trend IN ('increasing', 'decreasing', 'stable')),
  generated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(formula_id, forecast_month)
);

-- Safety stock recommendations
CREATE TABLE IF NOT EXISTS safety_stock_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id UUID REFERENCES raw_materials(id) ON DELETE CASCADE,
  recommended_min_kg NUMERIC NOT NULL,
  recommended_reorder_kg NUMERIC NOT NULL,
  based_on_months_data INTEGER NOT NULL,
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  avg_daily_usage_kg NUMERIC,
  max_daily_usage_kg NUMERIC,
  usage_variability NUMERIC,
  generated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(raw_material_id)
);

-- Demand anomalies tracking
CREATE TABLE IF NOT EXISTS demand_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID REFERENCES formulas(id) ON DELETE CASCADE,
  anomaly_month DATE NOT NULL,
  expected_orders INTEGER NOT NULL,
  actual_orders INTEGER NOT NULL,
  variance_percent NUMERIC,
  severity TEXT CHECK (severity IN ('critical', 'warning', 'normal', 'exceeding')),
  alerted_at TIMESTAMPTZ DEFAULT now(),
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  notes TEXT
);

-- Material usage trends view (simplified without customer data)
CREATE OR REPLACE VIEW v_material_usage_trends AS
SELECT 
  id.raw_material_id,
  rm.code as material_code,
  rm.name as material_name,
  DATE_TRUNC('month', cbd.completed_at) as usage_month,
  SUM(id.deducted_quantity_kg) as total_used_kg,
  COUNT(DISTINCT cbd.id) as batch_count,
  AVG(id.deducted_quantity_kg) as avg_per_batch
FROM ingredient_deductions id
JOIN completed_batch_deductions cbd ON cbd.id = id.completed_batch_id
JOIN raw_materials rm ON rm.id = id.raw_material_id
GROUP BY id.raw_material_id, rm.code, rm.name, usage_month;

-- Enable RLS policies
DO $rls$ BEGIN ALTER TABLE report_subscriptions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $rls$ BEGIN ALTER TABLE demand_forecasts ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $rls$ BEGIN ALTER TABLE safety_stock_recommendations ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;
DO $rls$ BEGIN ALTER TABLE demand_anomalies ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN wrong_object_type OR feature_not_supported THEN NULL; END $rls$;

-- RLS Policies for report_subscriptions
DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can view their own subscriptions" ON report_subscriptions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can view their own subscriptions"
  ON report_subscriptions FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can create their own subscriptions" ON report_subscriptions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can create their own subscriptions"
  ON report_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can update their own subscriptions" ON report_subscriptions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can update their own subscriptions"
  ON report_subscriptions FOR UPDATE
  USING (user_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON report_subscriptions; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Users can delete their own subscriptions"
  ON report_subscriptions FOR DELETE
  USING (user_id = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- RLS Policies for demand_forecasts
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view forecasts" ON demand_forecasts; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view forecasts"
  ON demand_forecasts FOR SELECT
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can manage forecasts" ON demand_forecasts; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can manage forecasts"
  ON demand_forecasts FOR ALL
  USING (has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- RLS Policies for safety_stock_recommendations
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view safety stock recommendations" ON safety_stock_recommendations; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view safety stock recommendations"
  ON safety_stock_recommendations FOR SELECT
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can manage safety stock recommendations" ON safety_stock_recommendations; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can manage safety stock recommendations"
  ON safety_stock_recommendations FOR ALL
  USING (has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

-- RLS Policies for demand_anomalies
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view demand anomalies" ON demand_anomalies; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view demand anomalies"
  ON demand_anomalies FOR SELECT
  USING (auth.uid() IS NOT NULL); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can acknowledge anomalies" ON demand_anomalies; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can acknowledge anomalies"
  ON demand_anomalies FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (acknowledged = true AND acknowledged_by = auth.uid()); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Only admins can create anomalies" ON demand_anomalies; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Only admins can create anomalies"
  ON demand_anomalies FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin')); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;