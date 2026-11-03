import { createClient } from '@supabase/supabase-js';
import { getRequest } from '@tanstack/react-start/server';

type ProviderName = 'gemini' | 'openrouter';
type EncryptedKeyRow = { provider: ProviderName; encrypted_key: string; iv: string; auth_tag: string };
type UserSupabaseClient = any;

function getEncryptionKey() {
  const hex = process.env['USER_AI_KEYS_ENCRYPTION_KEY'];
  if (!hex || !/^[a-f0-9]{64}$/i.test(hex)) {
    throw new Error('User AI key encryption is not configured on the server.');
  }
  return Uint8Array.from(hex.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}

async function cryptoKey() {
  return globalThis.crypto.subtle.importKey('raw', getEncryptionKey().buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptUserAIKey(value: string) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    await cryptoKey(),
    new TextEncoder().encode(value).buffer as ArrayBuffer,
  ));
  const tagLength = 16;
  const ciphertext = encrypted.slice(0, -tagLength);
  const tag = encrypted.slice(-tagLength);
  const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { encrypted_key: toHex(ciphertext), iv: toHex(iv), auth_tag: toHex(tag) };
}

async function decryptUserAIKey(row: EncryptedKeyRow) {
  const fromHex = (hex: string) => Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
  const ciphertext = fromHex(row.encrypted_key);
  const tag = fromHex(row.auth_tag);
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromHex(row.iv).buffer as ArrayBuffer },
    await cryptoKey(),
    combined.buffer as ArrayBuffer,
  );
  return new TextDecoder().decode(plaintext);
}

export async function getAuthenticatedAIContext(): Promise<{ userId: string; supabase: UserSupabaseClient }> {
  const request = getRequest();
  const authorization = request?.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('Unauthorized: sign in before using AI.');
  const token = authorization.slice(7);
  const url = process.env['SUPABASE_URL'];
  const publishableKey = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !publishableKey) throw new Error('Supabase server configuration is missing.');

  const supabase = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || typeof userId !== 'string' || !userId) {
    throw new Error('Unauthorized: your session is invalid. Please sign in again.');
  }
  return { userId, supabase };
}

export async function getUserAIKeys(userId: string, supabase: UserSupabaseClient): Promise<Partial<Record<ProviderName, string>>> {
  const { data, error } = await supabase
    .from('user_ai_keys')
    .select('provider, encrypted_key, iv, auth_tag')
    .eq('user_id', userId);
  if (error) throw new Error('Could not load your saved AI provider keys.');
  const keys: Partial<Record<ProviderName, string>> = {};
  for (const row of (data ?? []) as EncryptedKeyRow[]) {
    keys[row.provider] = await decryptUserAIKey(row);
  }
  return keys;
}

export async function saveUserAIKey(userId: string, provider: ProviderName, value: string, supabase: UserSupabaseClient) {
  if (value.length > 500 || /\s/.test(value)) throw new Error('The API key format is invalid.');
  const encrypted = await encryptUserAIKey(value.trim());
  const { error } = await supabase.from('user_ai_keys').upsert({
    user_id: userId,
    provider,
    ...encrypted,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });
  if (error) throw new Error('Could not securely save the AI key.');
}

export async function deleteUserAIKey(userId: string, provider: ProviderName, supabase: UserSupabaseClient) {
  const { error } = await supabase.from('user_ai_keys').delete().eq('user_id', userId).eq('provider', provider);
  if (error) throw new Error('Could not remove the saved AI key.');
}

export async function consumeDailyAIUsage(supabase: UserSupabaseClient) {
  const { data, error } = await supabase.rpc('increment_ai_usage');
  if (error) throw new Error('Could not verify your daily AI usage. Please try again.');
  if (typeof data !== 'number') {
    throw new Error('You have reached today’s limit of 15 AI requests on the shared free keys. Add your own Gemini or OpenRouter API key in Settings to continue with your own provider quota. Your limit resets at 00:00 UTC.');
  }
  return data;
}
