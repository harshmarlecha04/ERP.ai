-- Create label_inventory table
CREATE TABLE public.label_inventory (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_product TEXT NOT NULL,
    date DATE NOT NULL,
    received_qty NUMERIC DEFAULT 0,
    used_qty NUMERIC DEFAULT 0,
    on_hand NUMERIC DEFAULT 0,
    source_sheet TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for better performance
CREATE INDEX idx_label_inventory_customer_product ON public.label_inventory(customer_product);
CREATE INDEX idx_label_inventory_date ON public.label_inventory(date);
CREATE INDEX idx_label_inventory_customer_product_date ON public.label_inventory(customer_product, date);

-- Enable Row Level Security
ALTER TABLE public.label_inventory ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view label inventory" 
ON public.label_inventory 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create label inventory records" 
ON public.label_inventory 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update label inventory records" 
ON public.label_inventory 
FOR UPDATE 
USING (auth.uid() IS NOT NULL) 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete label inventory records" 
ON public.label_inventory 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_label_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_label_inventory_updated_at
    BEFORE UPDATE ON public.label_inventory
    FOR EACH ROW
    EXECUTE FUNCTION public.update_label_inventory_updated_at();