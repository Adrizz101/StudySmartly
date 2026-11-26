import { useCallback, useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import {
  getGamificationStats,
  recordGamificationActivity,
  type StudyActivity,
  type StudyStats,
} from '@/lib/gamification.functions';

const EMPTY_STATS: StudyStats = {
  current_streak: 0,
  longest_streak: 0,
  last_active_date: null,
  total_xp: 0,
  daily_xp: 0,
  daily_goal: 50,
};

const UPDATE_EVENT = 'studysmartly:gamification-updated';

function getLocalTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

export function useGamification() {
  const [stats, setStats] = useState<StudyStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const loadStats = useServerFn(getGamificationStats);
  const saveActivity = useServerFn(recordGamificationActivity);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setStats(EMPTY_STATS);
        return;
      }
      const result = await loadStats({
        data: { accessToken, timezone: getLocalTimezone() },
      });
      if (result.success) setStats(result.data);
    } catch (error) {
      console.warn('[Gamification] Could not refresh stats:', error);
    } finally {
      setLoading(false);
    }
  }, [loadStats]);

  const recordActivity = useCallback(async (action: StudyActivity) => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const accessToken = data.session?.access_token;
      if (!accessToken) return;

      const result = await saveActivity({
        data: {
          accessToken,
          action,
          eventId: crypto.randomUUID(),
          timezone: getLocalTimezone(),
        },
      });
      if (!result.success) {
        console.warn('[Gamification] Activity was not recorded.');
        return;
      }
      setStats(result.data);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(UPDATE_EVENT));
      }
    } catch (error) {
      // Gamification is non-critical and must never interrupt a study workflow.
      console.warn('[Gamification] Activity tracking failed:', error);
    }
  }, [saveActivity]);

  useEffect(() => {
    void refresh();
    const handleRefresh = () => { void refresh(); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener(UPDATE_EVENT, handleRefresh);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener(UPDATE_EVENT, handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refresh]);

  return { stats, loading, refresh, recordActivity };
}
