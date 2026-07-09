ALTER TABLE public.production_schedule_items
ADD COLUMN IF NOT EXISTS bottle_label_override text;