import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export function AIConsent({ consent, onConsent }: { consent: boolean; onConsent: (value: boolean) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    setError('');
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return <div className="ai-consent">
    <label className="flex items-start gap-2 text-xs text-text-muted">
      <input type="checkbox" checked={consent} onChange={e => onConsent(e.target.checked)} />
      <span>I am at least 18... [Terms and Privacy text here]</span>
    </label>

    {session ? (
      <p className="mt-2 text-xs text-text-muted">Signed in as {session.user.email}</p>
    ) : (
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={signInWithGoogle}>
          {busy ? 'Redirecting to Google…' : 'Continue with Google'}
        </Button>
      </div>
    )}
    {error && <p role="alert" className="text-study-rose-500 text-xs">{error}</p>}
  </div>;
}

export async function requireAISession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in with Google before using AI.');
  return data.session;
}
