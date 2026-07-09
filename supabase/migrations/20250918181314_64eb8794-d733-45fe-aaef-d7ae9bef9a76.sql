-- Add foreign key constraint between completed_batch_deductions and production_schedule_items
ALTER TABLE public.completed_batch_deductions 
ADD CONSTRAINT fk_completed_batch_deductions_schedule_item 
FOREIGN KEY (schedule_item_id) 
REFERENCES public.production_schedule_items(id) 
ON DELETE CASCADE;