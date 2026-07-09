-- Add new columns for yield tracking with moisture loss analytics
ALTER TABLE public.production_schedule_items 
ADD COLUMN IF NOT EXISTS avg_wet_piece_weight_g NUMERIC,
ADD COLUMN IF NOT EXISTS moisture_loss_percent NUMERIC,
ADD COLUMN IF NOT EXISTS weighed_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN public.production_schedule_items.avg_wet_piece_weight_g IS 'Average weight of each gummy piece when wet (in grams), captured during post-mixing weigh-up';
COMMENT ON COLUMN public.production_schedule_items.moisture_loss_percent IS 'Calculated moisture loss percentage from wet to packaged state';
COMMENT ON COLUMN public.production_schedule_items.weighed_at IS 'Timestamp when the wet weight was recorded after mixing';