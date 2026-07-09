
CREATE TABLE public.rd_received_samples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rd_project_id UUID NOT NULL REFERENCES public.rd_projects(id) ON DELETE CASCADE,
  received_date DATE,
  made_on_date DATE,
  product_name TEXT,
  mold_size TEXT,
  lot_number TEXT,
  flavor TEXT,
  color TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  on_hand BOOLEAN NOT NULL DEFAULT false,
  quantity_on_hand INTEGER,
  received_by UUID,
  received_by_name TEXT,
  received_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_rd_received_samples_project ON public.rd_received_samples(rd_project_id);

ALTER TABLE public.rd_received_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RD managers and admins can view rd_received_samples"
ON public.rd_received_samples
FOR SELECT
USING (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "RD managers and admins can create rd_received_samples"
ON public.rd_received_samples
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "RD managers and admins can update rd_received_samples"
ON public.rd_received_samples
FOR UPDATE
USING (has_role(auth.uid(), 'rd_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete rd_received_samples"
ON public.rd_received_samples
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_rd_received_samples_updated_at
BEFORE UPDATE ON public.rd_received_samples
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
