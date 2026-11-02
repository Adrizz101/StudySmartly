import { supabase } from '@/integrations/supabase/client';

/**
 * Stores privacy-conscious event metadata for signed-in users.
 * Never pass free-text feedback, prompts, email addresses, or credentials.
 */
export type AnalyticsProperties = Record<string, unknown>;

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}): void {
  void (async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const excluded = new Set(['account_id', 'user_id', 'email', 'prompt', 'content', 'description', 'feedback_text', 'api_key']);
      const safeProperties = Object.fromEntries(
        Object.entries(properties)
          .filter(([key, value]) => !excluded.has(key.toLowerCase()) &&
            (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null))
          .slice(0, 20),
      );

      const { error } = await (supabase as any).from('analytics_events').insert({
        user_id: user.id,
        event_name: eventName.slice(0, 100),
        properties: safeProperties,
      });
      if (error) console.warn('[Analytics] Event could not be stored:', error.message);
    } catch (error) {
      console.warn('[Analytics] Event could not be stored:', error);
    }
  })();
}
