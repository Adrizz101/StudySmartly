import { supabase } from '@/integrations/supabase/client';

export function AIConsent({ consent, onConsent }: { consent: boolean; onConsent: (value: boolean) => void }) {
  return <div className="ai-consent">
    <label className="flex items-start gap-2 text-xs text-text-muted">
      <input type="checkbox" checked={consent} onChange={e => onConsent(e.target.checked)} />
      <span>I am at least 18... [Terms and Privacy text here]</span>
    </label>
  </div>;
}

export async function requireAISession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in with your email magic link before using AI.');
  return data.session;
}
