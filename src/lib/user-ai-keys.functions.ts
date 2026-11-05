import { createMiddleware, createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';


type ServerResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function safeResult<T>(feature: string, friendlyMessage: string, operation: () => Promise<T> | T): Promise<ServerResult<T>> {
  try {
    return { success: true, data: await operation() };
  } catch (error) {
    console.error(`[AI key settings] ${feature} failed:`, error);
    return { success: false, error: friendlyMessage };
  }
}

const safeServerBoundary = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    console.error('[AI key settings] Server function boundary failed:', error);
    return { success: false as const, error: 'This request could not be completed. Please sign in again and retry.' };
  }
});

const keyInput = z.object({
  geminiKey: z.string().max(500).default(''),
  openRouterKey: z.string().max(500).default(''),
  removeGemini: z.boolean().default(false),
  removeOpenRouter: z.boolean().default(false),
});

export const saveUserAIKeys = createServerFn({ method: 'POST' })
  .middleware([safeServerBoundary, requireSupabaseAuth])
  .inputValidator(keyInput)
  .handler(async ({ data, context }) => safeResult('saveUserAIKeys', 'Could not save your AI key settings. Please try again.', async () => {
    const userId = context.userId;
    const { deleteUserAIKey, saveUserAIKey } = await import('./user-ai-keys.server');
    const supabase = context.supabase as any;
    if (data.removeGemini) await deleteUserAIKey(userId, 'gemini', supabase);
    else if (data.geminiKey.trim()) await saveUserAIKey(userId, 'gemini', data.geminiKey, supabase);
    if (data.removeOpenRouter) await deleteUserAIKey(userId, 'openrouter', supabase);
    else if (data.openRouterKey.trim()) await saveUserAIKey(userId, 'openrouter', data.openRouterKey, supabase);
    return { updated: true };
  }));

export const getUserAIKeyStatus = createServerFn({ method: 'GET' })
  .middleware([safeServerBoundary, requireSupabaseAuth])
  .handler(async ({ context }) => safeResult('getUserAIKeyStatus', 'Could not load saved AI key status. Please refresh and try again.', async () => {
    const supabase = context.supabase as any;
    const { data, error } = await supabase
      .from('user_ai_keys')
      .select('provider')
      .eq('user_id', context.userId);
    if (error) throw new Error('Could not load saved AI key status.');
    const providers = new Set((data ?? []).map((row: { provider: string }) => row.provider));
    return { gemini: providers.has('gemini'), openrouter: providers.has('openrouter') };
  }));
