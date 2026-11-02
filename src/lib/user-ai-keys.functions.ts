import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

const keyInput = z.object({
  geminiKey: z.string().max(500).default(''),
  openRouterKey: z.string().max(500).default(''),
  removeGemini: z.boolean().default(false),
  removeOpenRouter: z.boolean().default(false),
});

export const saveUserAIKeys = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(keyInput)
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { deleteUserAIKey, saveUserAIKey } = await import('./user-ai-keys.server');
    const supabase = context.supabase as any;
    if (data.removeGemini) await deleteUserAIKey(userId, 'gemini', supabase);
    else if (data.geminiKey.trim()) await saveUserAIKey(userId, 'gemini', data.geminiKey, supabase);
    if (data.removeOpenRouter) await deleteUserAIKey(userId, 'openrouter', supabase);
    else if (data.openRouterKey.trim()) await saveUserAIKey(userId, 'openrouter', data.openRouterKey, supabase);
    return { success: true };
  });

export const getUserAIKeyStatus = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as any;
    const { data, error } = await supabase
      .from('user_ai_keys')
      .select('provider')
      .eq('user_id', context.userId);
    if (error) throw new Error('Could not load saved AI key status.');
    const providers = new Set((data ?? []).map((row: { provider: string }) => row.provider));
    return { gemini: providers.has('gemini'), openrouter: providers.has('openrouter') };
  });
