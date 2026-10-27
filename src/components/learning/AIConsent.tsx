import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export function AIConsent({ consent, onConsent }: { consent: boolean; onConsent: (value: boolean) => void }) {
  const [error, setError] = useState('');
  const [signedIn, setSignedIn] = useState(false);

  async function signIn() {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    else setSignedIn(true);
  }

  return <div className="ai-consent">
    <label className="flex items-start gap-2 text-xs text-text-muted">
      <input type="checkbox" checked={consent} onChange={e => onConsent(e.target.checked)} />
      <span>I am at least 18... [Terms and Privacy text here]</span>
    </label>
    
    {!signedIn && <div className="mt-2 flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={signIn}>Continue with Google</Button>
    </div>}
    {error && <p role="alert" className="text-study-rose-500 text-xs">{error}</p>}
  </div>;
}

export async function requireAISession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in with Google before using AI.');
  return data.session;
}
