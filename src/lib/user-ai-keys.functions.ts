import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { saveUserAIKey } from './user-ai-keys.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const keyInput = z.object({
  geminiKey: z.string().max(500).default(''),
  openRouterKey: z.string().max(500).default(''),
});

export const saveUserAIKeys = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(keyInput)
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    await saveUserAIKey(userId, 'gemini', data.geminiKey);
    await saveUserAIKey(userId, 'openrouter', data.openRouterKey);
    return { success: true };
  });

export const getUserAIKeyStatus = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = supabaseAdmin as any;
    const { data, error } = await admin
      .from('user_ai_keys')
      .select('provider')
      .eq('user_id', context.userId);
    if (error) throw new Error('Could not load saved AI key status.');
    const providers = new Set((data ?? []).map((row: { provider: string }) => row.provider));
    return { gemini: providers.has('gemini'), openrouter: providers.has('openrouter') };
  });
