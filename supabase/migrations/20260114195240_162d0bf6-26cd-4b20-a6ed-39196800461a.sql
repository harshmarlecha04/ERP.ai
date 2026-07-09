-- Add pdf_url column to order_headers for storing PO PDF references
ALTER TABLE order_headers ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Create storage bucket for order PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('order-pdfs', 'order-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the order-pdfs bucket
DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can view order PDFs" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can view order PDFs" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'order-pdfs' AND auth.role() = 'authenticated'); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can upload order PDFs" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can upload order PDFs" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'order-pdfs' AND auth.role() = 'authenticated'); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can delete order PDFs" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can delete order PDFs" 
  ON storage.objects FOR DELETE 
  USING (bucket_id = 'order-pdfs' AND auth.role() = 'authenticated'); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;

DO $pol$ BEGIN DROP POLICY IF EXISTS "Authenticated users can update order PDFs" ON storage.objects; EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;
DO $pol$ BEGIN CREATE POLICY "Authenticated users can update order PDFs" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'order-pdfs' AND auth.role() = 'authenticated'); EXCEPTION WHEN wrong_object_type OR undefined_object OR undefined_table THEN NULL; END $pol$;