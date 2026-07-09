-- Clean up orphaned records in production_ingredient_usage
DELETE FROM public.production_ingredient_usage 
WHERE schedule_item_id NOT IN (
    SELECT id FROM public.production_schedule_items
);

-- Add foreign key constraint for production_ingredient_usage
ALTER TABLE public.production_ingredient_usage DROP CONSTRAINT IF EXISTS fk_production_ingredient_usage_schedule_item;
ALTER TABLE public.production_ingredient_usage 
ADD CONSTRAINT fk_production_ingredient_usage_schedule_item 
FOREIGN KEY (schedule_item_id) REFERENCES public.production_schedule_items(id) 
ON DELETE CASCADE ON UPDATE CASCADE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_production_ingredient_usage_schedule_item_id 
ON public.production_ingredient_usage(schedule_item_id);