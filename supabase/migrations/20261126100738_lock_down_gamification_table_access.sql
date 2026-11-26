CREATE POLICY user_streaks_deny_direct_access
  ON public.user_streaks
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY user_study_activity_deny_direct_access
  ON public.user_study_activity
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);