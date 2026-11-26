import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const timezoneSchema = z.string().trim().min(1).max(80).default('Asia/Kolkata');
const statsSchema = z.object({
  current_streak: z.number().int().nonnegative(),
  longest_streak: z.number().int().nonnegative(),
  last_active_date: z.string().nullable(),
  total_xp: z.number().int().nonnegative(),
  daily_xp: z.number().int().nonnegative(),
  daily_goal: z.number().int().positive(),
});

export type StudyStats = z.infer<typeof statsSchema>;
export type StudyActivity = 'tutor_chat' | 'flashcard_review' | 'exam_submit';

const emptyStats: StudyStats = {
  current_streak: 0,
  longest_streak: 0,
  last_active_date: null,
  total_xp: 0,
  daily_xp: 0,
  daily_goal: 50,
};

export const getGamificationStats = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    accessToken: z.string().min(1),
    timezone: timezoneSchema,
  }))
  .handler(async ({ data }) => {
    try {
      const { getAuthenticatedAIContext } = await import('@/lib/user-ai-keys.server');
      const { supabase } = await getAuthenticatedAIContext(data.accessToken);
      const { data: result, error } = await supabase.rpc('get_user_study_stats', {
        p_timezone: data.timezone,
      });
      if (error) throw error;
      const parsed = statsSchema.safeParse(result);
      if (!parsed.success) throw new Error('The study stats response was invalid.');
      return { success: true as const, data: parsed.data };
    } catch (error) {
      console.error('[Gamification] Could not load study stats:', error);
      return { success: false as const, error: 'Could not load study stats.', data: emptyStats };
    }
  });

export const recordGamificationActivity = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    accessToken: z.string().min(1),
    action: z.enum(['tutor_chat', 'flashcard_review', 'exam_submit']),
    eventId: z.string().uuid(),
    timezone: timezoneSchema,
  }))
  .handler(async ({ data }) => {
    try {
      const { getAuthenticatedAIContext } = await import('@/lib/user-ai-keys.server');
      const { supabase } = await getAuthenticatedAIContext(data.accessToken);
      const { data: result, error } = await supabase.rpc('record_study_activity', {
        p_action: data.action,
        p_event_id: data.eventId,
        p_timezone: data.timezone,
      });
      if (error) throw error;
      const parsed = statsSchema.safeParse(result);
      if (!parsed.success) throw new Error('The updated study stats response was invalid.');
      return { success: true as const, data: parsed.data };
    } catch (error) {
      console.error('[Gamification] Could not record study activity:', error);
      return { success: false as const, error: 'Could not record study activity.' };
    }
  });
