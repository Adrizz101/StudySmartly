CREATE OR REPLACE FUNCTION public.get_user_study_stats(p_timezone text DEFAULT 'Asia/Kolkata')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date;
  v_stats jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_timezone IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone
  ) THEN
    RAISE EXCEPTION 'Invalid timezone';
  END IF;

  v_today := (pg_catalog.now() AT TIME ZONE p_timezone)::date;

  SELECT pg_catalog.jsonb_build_object(
    'current_streak', CASE
      WHEN s.last_active_date < v_today - 1 THEN 0
      ELSE s.current_streak
    END,
    'longest_streak', s.longest_streak,
    'last_active_date', s.last_active_date,
    'total_xp', s.total_xp,
    'daily_xp', CASE WHEN s.daily_xp_date = v_today THEN s.daily_xp ELSE 0 END,
    'daily_goal', 50
  )
  INTO v_stats
  FROM public.user_streaks AS s
  WHERE s.user_id = v_user_id;

  RETURN COALESCE(v_stats, pg_catalog.jsonb_build_object(
    'current_streak', 0,
    'longest_streak', 0,
    'last_active_date', NULL,
    'total_xp', 0,
    'daily_xp', 0,
    'daily_goal', 50
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_study_stats(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_study_stats(text) TO authenticated;