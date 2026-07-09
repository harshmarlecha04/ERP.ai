
DO $df$ DECLARE r record; BEGIN FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE proname='launch_weekly_status_reminder' AND pronamespace='public'::regnamespace LOOP EXECUTE 'DROP FUNCTION ' || r.sig; END LOOP; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END $df$;
CREATE OR REPLACE FUNCTION public.launch_weekly_status_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id, p.name, COALESCE(c.project_owner_id, p.owner_id) AS owner_id
    FROM public.launch_projects p
    LEFT JOIN public.launch_charters c ON c.project_id = p.id
    WHERE p.status IN ('planning','active')
      AND COALESCE(c.project_owner_id, p.owner_id) IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, action_url)
    VALUES (
      r.owner_id,
      'Weekly status update due',
      'Capture this week''s status snapshot for ' || r.name,
      'launch_status_reminder',
      '/launch/projects/' || r.id::text
    );
  END LOOP;
END;
$$;
