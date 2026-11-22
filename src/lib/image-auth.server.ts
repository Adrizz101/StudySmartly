import { createClient } from '@supabase/supabase-js';

export type ImageAuthorization = {
  userId: string;
  supabase: ReturnType<typeof createClient>;
};

export async function authorizeImage(request: Request): Promise<ImageAuthorization | Response> {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!url || !key || !token) return new Response('Sign in before generating images.', { status: 401 });

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith('sb_')) headers.delete('Authorization');
        headers.set('apikey', key);
        headers.set('Authorization', `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return new Response('Your session has expired. Sign in again.', { status: 401 });
  return { userId: data.user.id, supabase };
}

export async function chargeDailyImageUsage(supabase: ImageAuthorization['supabase'], requestId: string) {
  const { data, error } = await supabase.rpc('charge_image_usage', { p_request_id: requestId });
  if (error || typeof data !== 'number') {
    throw new Error('Could not verify your daily image usage. Please try again.');
  }
  return data;
}

export async function refundDailyImageUsage(supabase: ImageAuthorization['supabase'], requestId: string) {
  const { error } = await supabase.rpc('refund_image_usage', { p_request_id: requestId });
  if (error) {
    console.error('[Image Quota] Could not refund image usage:', error);
  }
}
