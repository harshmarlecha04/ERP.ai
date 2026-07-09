-- Add foreign key constraint for production_ingredient_usage
ALTER TABLE public.production_ingredient_usage 
ADD CONSTRAINT fk_production_ingredient_usage_schedule_item 
FOREIGN KEY (schedule_item_id) REFERENCES public.production_schedule_items(id) 
ON DELETE CASCADE ON UPDATE CASCADE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_production_ingredient_usage_schedule_item_id 
ON public.production_ingredient_usage(schedule_item_id);