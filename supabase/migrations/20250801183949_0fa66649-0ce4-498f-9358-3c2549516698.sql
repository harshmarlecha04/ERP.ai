-- Create storage bucket for COA files
INSERT INTO storage.buckets (id, name, public) VALUES ('coa-files', 'coa-files', false);

-- Create storage policies for COA files
CREATE POLICY "Users can view COA files" ON storage.objects FOR SELECT USING (bucket_id = 'coa-files');
CREATE POLICY "Users can upload COA files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'coa-files');
CREATE POLICY "Users can update COA files" ON storage.objects FOR UPDATE USING (bucket_id = 'coa-files');
CREATE POLICY "Users can delete COA files" ON storage.objects FOR DELETE USING (bucket_id = 'coa-files');

-- Create table for raw materials
CREATE TABLE public.raw_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  supplier TEXT NOT NULL,
  unit_of_measure TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for raw material lots
CREATE TABLE public.raw_material_lots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  quantity DECIMAL NOT NULL,
  cost DECIMAL NOT NULL,
  expiry_date DATE,
  coa_file_path TEXT,
  coa_file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(raw_material_id, lot_number)
);

-- Enable RLS
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_material_lots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (public access for now, can be restricted later)
CREATE POLICY "Anyone can view raw materials" ON public.raw_materials FOR SELECT USING (true);
CREATE POLICY "Anyone can insert raw materials" ON public.raw_materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update raw materials" ON public.raw_materials FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete raw materials" ON public.raw_materials FOR DELETE USING (true);

CREATE POLICY "Anyone can view raw material lots" ON public.raw_material_lots FOR SELECT USING (true);
CREATE POLICY "Anyone can insert raw material lots" ON public.raw_material_lots FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update raw material lots" ON public.raw_material_lots FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete raw material lots" ON public.raw_material_lots FOR DELETE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_raw_materials_updated_at
  BEFORE UPDATE ON public.raw_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_raw_material_lots_updated_at
  BEFORE UPDATE ON public.raw_material_lots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();