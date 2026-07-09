CREATE OR REPLACE FUNCTION public.fn_upsert_schedule(p_schedule_date date)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.production_schedules(schedule_date)
  VALUES (p_schedule_date)
  ON CONFLICT (schedule_date) DO NOTHING;

  SELECT id INTO v_id
  FROM public.production_schedules
  WHERE schedule_date = p_schedule_date;

  RETURN v_id;
END;
$$;