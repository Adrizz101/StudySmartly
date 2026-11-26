CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak integer NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_active_date date,
  total_xp integer NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  daily_xp integer NOT NULL DEFAULT 0 CHECK (daily_xp >= 0 AND daily_xp <= 50),
  daily_xp_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_streaks_longest_gte_current CHECK (longest_streak >= current_streak)
);

CREATE TABLE IF NOT EXISTS public.user_study_activity (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('tutor_chat', 'flashcard_review', 'exam_submit')),
  xp_awarded integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0 AND xp_awarded <= 15),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_study_activity ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_streaks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_study_activity FROM PUBLIC, anon, authenticated;

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
    'current_streak', s.current_streak,
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

CREATE OR REPLACE FUNCTION public.record_study_activity(
  p_action text,
  p_event_id uuid,
  p_timezone text DEFAULT 'Asia/Kolkata'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date;
  v_xp integer;
  v_awarded_xp integer;
  v_inserted_rows integer;
  v_current_streak integer;
  v_longest_streak integer;
  v_last_active_date date;
  v_total_xp integer;
  v_daily_xp integer;
  v_daily_xp_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'Activity event ID is required';
  END IF;

  IF p_timezone IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone
  ) THEN
    RAISE EXCEPTION 'Invalid timezone';
  END IF;

  v_xp := CASE p_action
    WHEN 'tutor_chat' THEN 10
    WHEN 'flashcard_review' THEN 5
    WHEN 'exam_submit' THEN 15
    ELSE NULL
  END;

  IF v_xp IS NULL THEN
    RAISE EXCEPTION 'Unsupported study activity';
  END IF;

  v_today := (pg_catalog.now() AT TIME ZONE p_timezone)::date;

  INSERT INTO public.user_streaks (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT current_streak, longest_streak, last_active_date, total_xp, daily_xp, daily_xp_date
  INTO v_current_streak, v_longest_streak, v_last_active_date, v_total_xp, v_daily_xp, v_daily_xp_date
  FROM public.user_streaks
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_daily_xp_date IS DISTINCT FROM v_today THEN
    v_daily_xp := 0;
  END IF;

  v_awarded_xp := LEAST(v_xp, GREATEST(0, 50 - v_daily_xp));

  INSERT INTO public.user_study_activity (user_id, event_id, action, xp_awarded)
  VALUES (v_user_id, p_event_id, p_action, v_awarded_xp)
  ON CONFLICT (user_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;
  IF v_inserted_rows = 0 THEN
    RETURN public.get_user_study_stats(p_timezone);
  END IF;

  IF v_last_active_date IS NULL THEN
    v_current_streak := 1;
  ELSIF v_last_active_date < v_today THEN
    IF v_last_active_date = v_today - 1 THEN
      v_current_streak := v_current_streak + 1;
    ELSE
      v_current_streak := 1;
    END IF;
  END IF;

  v_longest_streak := GREATEST(v_longest_streak, v_current_streak);
  v_daily_xp := v_daily_xp + v_awarded_xp;

  UPDATE public.user_streaks
  SET current_streak = v_current_streak,
      longest_streak = v_longest_streak,
      last_active_date = CASE
        WHEN last_active_date IS NULL OR last_active_date <= v_today THEN v_today
        ELSE last_active_date
      END,
      total_xp = total_xp + v_awarded_xp,
      daily_xp = v_daily_xp,
      daily_xp_date = v_today,
      updated_at = pg_catalog.now()
  WHERE user_id = v_user_id;

  RETURN public.get_user_study_stats(p_timezone);
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_study_stats(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_study_activity(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_study_stats(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_study_activity(text, uuid, text) TO authenticated;