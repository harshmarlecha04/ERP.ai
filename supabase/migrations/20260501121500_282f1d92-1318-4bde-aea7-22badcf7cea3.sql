
-- ============================================================
-- COA SETTINGS (global default + per-formula overrides)
-- ============================================================
CREATE TABLE public.coa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id uuid REFERENCES public.formulas(id) ON DELETE CASCADE,
  is_global_default boolean NOT NULL DEFAULT false,
  qf_revision text NOT NULL DEFAULT 'QF=009-2 Revision: 03',
  shelf_life_text text NOT NULL DEFAULT '2 years from date of manufacturing',
  storage_condition text NOT NULL DEFAULT 'Store in original, unopened packaging at 25°C with relative humidity ≤60%. Protect from direct sunlight.',
  shelf_life_bullets jsonb NOT NULL DEFAULT '["Bulk product to be packaged into retail packaging (PET bottle with aluminum foil seal or aluminum foil bag) within 3 months of manufacture.", "Shelf life: 24 months from manufacture date when stored under recommended temperature conditions and packaged as specified. 25°C and 60% RH"]'::jsonb,
  transport_text text NOT NULL DEFAULT 'Pharmvista strongly recommends that customers use temperature-controlled transportation for all shipments throughout the year.',
  data_logger_text text NOT NULL DEFAULT 'Pharmvista has included one data the customer must download the data upon receipt of the product and share the details embedded in the data logger. If the customer does not provide the data from the data logger, Pharmvista will not acknowledge or investigate any quality issues related to the purity, quality, safety, and efficacy of the product.',
  overage_text text NOT NULL DEFAULT 'Pharmvista adds appropriate overage to the product as needed. Overages were added to prevent the loss of potency that may occur during long term storage of the product. Pharmvista includes an appropriate overage to compensate for potential potency loss during heat exposure in the manufacturing process.',
  analytical_testing_text text NOT NULL DEFAULT 'Pharmvista''s products are designed and formulated to be stable only at room temperature (RT) (25°C and 60% RH), Pharmvista cannot be held responsible for any test failures of products tested at any temperature below or above RT listed above. Pharmvista gummies are manufactured using a starch-free process, with pectin and non-GMO seaweed used as binding agents. A product-specific liquid nitrogen method must be used to perform analytical testing of the product. Pharmvista uses one of the three different testing approaches: assay testing, quantity verification, and identity verification.',
  stability_text text NOT NULL DEFAULT 'Pharmvista does not perform stability testing, shipping validation, or process validation for all products, as these are not mandated by USFDA regulations. If the customer requires any of these services, Pharmvista can perform them at an additional cost.',
  allergen_text text NOT NULL DEFAULT 'Our products are devoid of Milk, Egg, Fish, Crustacean Shellfish, Tree Nuts, Wheat, Peanuts, Gluten, Soybeans and Sesame.',
  others_bullets jsonb NOT NULL DEFAULT '["Because natural color sources are used, the product''s color may vary slightly over its shelf life.", "Because natural flavorings are used, the product''s taste may vary slightly over its shelf life."]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coa_settings_global_or_formula CHECK (
    (is_global_default = true AND formula_id IS NULL) OR
    (is_global_default = false AND formula_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX coa_settings_global_unique
  ON public.coa_settings ((is_global_default))
  WHERE is_global_default = true;

CREATE UNIQUE INDEX coa_settings_formula_unique
  ON public.coa_settings (formula_id)
  WHERE formula_id IS NOT NULL;

-- Seed the single global default row
INSERT INTO public.coa_settings (is_global_default) VALUES (true);

-- ============================================================
-- CERTIFICATES OF ANALYSIS (audit log of generated COAs)
-- ============================================================
CREATE TABLE public.certificates_of_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id uuid NOT NULL REFERENCES public.formulas(id) ON DELETE CASCADE,
  batch_lot text NOT NULL,
  customer_name text NOT NULL,
  remark text,
  manufacturing_date date,
  expiration_date date,
  shelf_life_text text NOT NULL DEFAULT '2 years from date of manufacturing',
  qf_revision text NOT NULL DEFAULT 'QF=009-2 Revision: 03',
  -- Snapshot of the parsed/edited test data used to render this PDF
  generated_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_path text,
  generated_by uuid REFERENCES auth.users(id),
  approved_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX certificates_of_analysis_formula_id_idx
  ON public.certificates_of_analysis (formula_id, created_at DESC);

-- ============================================================
-- USER SIGNATURES (one per user)
-- ============================================================
CREATE TABLE public.user_signatures (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  signature_path text NOT NULL,
  approver_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE TRIGGER trg_coa_settings_updated
  BEFORE UPDATE ON public.coa_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_user_signatures_updated
  BEFORE UPDATE ON public.user_signatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.coa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates_of_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;

-- coa_settings: any authenticated user can read; only admins can modify
CREATE POLICY "coa_settings_select_auth"
  ON public.coa_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "coa_settings_insert_admin"
  ON public.coa_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "coa_settings_update_admin"
  ON public.coa_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "coa_settings_delete_admin"
  ON public.coa_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- certificates_of_analysis: authenticated users can read, insert; only admin can delete
CREATE POLICY "coa_select_auth"
  ON public.certificates_of_analysis FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "coa_insert_auth"
  ON public.certificates_of_analysis FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = generated_by);

CREATE POLICY "coa_update_admin"
  ON public.certificates_of_analysis FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "coa_delete_admin"
  ON public.certificates_of_analysis FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- user_signatures: each user manages their own only
CREATE POLICY "sig_select_own"
  ON public.user_signatures FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "sig_insert_own"
  ON public.user_signatures FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sig_update_own"
  ON public.user_signatures FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sig_delete_own"
  ON public.user_signatures FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('coa-pdfs', 'coa-pdfs', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', false)
ON CONFLICT (id) DO NOTHING;

-- coa-pdfs: any authenticated user can read & insert
CREATE POLICY "coa_pdfs_select_auth"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'coa-pdfs');

CREATE POLICY "coa_pdfs_insert_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'coa-pdfs');

CREATE POLICY "coa_pdfs_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'coa-pdfs' AND public.has_role(auth.uid(), 'admin'));

-- signatures: each user can read/write their own folder (path = {user_id}/...)
CREATE POLICY "signatures_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "signatures_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "signatures_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "signatures_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1]);
