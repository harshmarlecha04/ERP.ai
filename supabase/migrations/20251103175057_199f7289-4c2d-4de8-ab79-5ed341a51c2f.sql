-- Create rd_projects table
CREATE TABLE rd_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  flavor TEXT NOT NULL,
  color TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_development',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  converted_to_formula_id UUID REFERENCES formulas(id),
  converted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES auth.users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT
);

-- Create rd_project_actives table
CREATE TABLE rd_project_actives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rd_project_id UUID REFERENCES rd_projects(id) ON DELETE CASCADE,
  active_name TEXT NOT NULL,
  mg_per_gummy NUMERIC NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create rd_project_batches table
CREATE TABLE rd_project_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rd_project_id UUID REFERENCES rd_projects(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_produced TEXT,
  sent_to TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Create rd_batch_feedback table
CREATE TABLE rd_batch_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rd_batch_id UUID REFERENCES rd_project_batches(id) ON DELETE CASCADE,
  feedback_text TEXT NOT NULL,
  feedback_source TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE rd_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE rd_project_actives ENABLE ROW LEVEL SECURITY;
ALTER TABLE rd_project_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rd_batch_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies - All authenticated users
CREATE POLICY "All users can view rd_projects" ON rd_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "All users can insert rd_projects" ON rd_projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "All users can update rd_projects" ON rd_projects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "All users can delete rd_projects" ON rd_projects FOR DELETE TO authenticated USING (true);

CREATE POLICY "All users can view rd_project_actives" ON rd_project_actives FOR SELECT TO authenticated USING (true);
CREATE POLICY "All users can insert rd_project_actives" ON rd_project_actives FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "All users can update rd_project_actives" ON rd_project_actives FOR UPDATE TO authenticated USING (true);
CREATE POLICY "All users can delete rd_project_actives" ON rd_project_actives FOR DELETE TO authenticated USING (true);

CREATE POLICY "All users can view rd_project_batches" ON rd_project_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "All users can insert rd_project_batches" ON rd_project_batches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "All users can update rd_project_batches" ON rd_project_batches FOR UPDATE TO authenticated USING (true);
CREATE POLICY "All users can delete rd_project_batches" ON rd_project_batches FOR DELETE TO authenticated USING (true);

CREATE POLICY "All users can view rd_batch_feedback" ON rd_batch_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "All users can insert rd_batch_feedback" ON rd_batch_feedback FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "All users can update rd_batch_feedback" ON rd_batch_feedback FOR UPDATE TO authenticated USING (true);
CREATE POLICY "All users can delete rd_batch_feedback" ON rd_batch_feedback FOR DELETE TO authenticated USING (true);

-- Create indexes
CREATE INDEX idx_rd_projects_customer ON rd_projects(customer_id);
CREATE INDEX idx_rd_projects_status ON rd_projects(status);
CREATE INDEX idx_rd_project_actives_project ON rd_project_actives(rd_project_id);
CREATE INDEX idx_rd_project_batches_project ON rd_project_batches(rd_project_id);
CREATE INDEX idx_rd_batch_feedback_batch ON rd_batch_feedback(rd_batch_id);
CREATE INDEX idx_rd_projects_converted_formula ON rd_projects(converted_to_formula_id);

-- Create function to convert R&D to production formula
CREATE OR REPLACE FUNCTION convert_rd_to_production(
  p_rd_project_id UUID
) RETURNS UUID AS $$
DECLARE
  v_formula_id UUID;
  v_project RECORD;
  v_actives JSONB;
BEGIN
  SELECT * INTO v_project FROM rd_projects WHERE id = p_rd_project_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'R&D Project not found';
  END IF;
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'active_name', active_name,
      'mg_per_gummy', mg_per_gummy
    ) ORDER BY sort_order
  ) INTO v_actives
  FROM rd_project_actives
  WHERE rd_project_id = p_rd_project_id;
  
  INSERT INTO formulas (
    code,
    name,
    customer_id,
    default_batch_size_kg,
    active_ingredients_json,
    status,
    notes
  ) VALUES (
    v_project.project_number || '-PROD',
    v_project.customer_name || ' - ' || v_project.flavor || ' - ' || v_project.color,
    v_project.customer_id,
    0,
    v_actives,
    'draft',
    'Converted from R&D Project: ' || v_project.project_number || E'\nFlavor: ' || v_project.flavor || E'\nColor: ' || v_project.color
  )
  RETURNING id INTO v_formula_id;
  
  UPDATE rd_projects
  SET 
    status = 'converted_to_production',
    converted_to_formula_id = v_formula_id,
    converted_at = now()
  WHERE id = p_rd_project_id;
  
  RETURN v_formula_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;