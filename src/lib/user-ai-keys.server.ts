import { supabaseAdmin } from '@/integrations/supabase/client.server';

type ProviderName = 'gemini' | 'openrouter';
type EncryptedKeyRow = { provider: ProviderName; encrypted_key: string; iv: string; auth_tag: string };

function getEncryptionKey() {
  const hex = process.env['USER_AI_KEYS_ENCRYPTION_KEY'];
  if (!hex || !/^[a-f0-9]{64}$/i.test(hex)) {
    throw new Error('User AI key encryption is not configured on the server.');
  }
  return Uint8Array.from(hex.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}

async function cryptoKey() {
  return globalThis.crypto.subtle.importKey('raw', getEncryptionKey(), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptUserAIKey(value: string) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await cryptoKey(),
    new TextEncoder().encode(value),
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
    { name: 'AES-GCM', iv: fromHex(row.iv) },
    await cryptoKey(),
    combined,
  );
  return new TextDecoder().decode(plaintext);
}

export async function getUserAIKeys(userId: string): Promise<Partial<Record<ProviderName, string>>> {
  const { data, error } = await supabaseAdmin
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

export async function saveUserAIKey(userId: string, provider: ProviderName, value: string) {
  if (!value.trim()) {
    const { error } = await supabaseAdmin.from('user_ai_keys').delete().eq('user_id', userId).eq('provider', provider);
    if (error) throw new Error('Could not remove the saved AI key.');
    return;
  }
  if (value.length > 500 || /\s/.test(value)) throw new Error('The API key format is invalid.');
  const encrypted = await encryptUserAIKey(value.trim());
  const { error } = await supabaseAdmin.from('user_ai_keys').upsert({
    user_id: userId,
    provider,
    ...encrypted,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });
  if (error) throw new Error('Could not securely save the AI key.');
}

export async function consumeDailyAIUsage(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin.rpc('increment_ai_usage', {
    p_user_id: userId,
    p_usage_date: today,
  });
  if (error) throw new Error('Could not verify your daily AI usage. Please try again.');
  if (typeof data !== 'number') {
    throw new Error('You have reached today’s limit of 15 AI requests on the shared free keys. Add your own Gemini or OpenRouter API key in Settings to continue with your own provider quota. Your limit resets at 00:00 UTC.');
  }
  return data;
}
