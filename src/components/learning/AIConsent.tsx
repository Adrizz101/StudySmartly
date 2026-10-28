import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export function AIConsent({ consent, onConsent }: { consent: boolean; onConsent: (value: boolean) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
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

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setError('');
    setSent(false);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return <div className="ai-consent">
    <label className="flex items-start gap-2 text-xs text-text-muted">
      <input type="checkbox" checked={consent} onChange={e => onConsent(e.target.checked)} />
      <span>I am at least 18... [Terms and Privacy text here]</span>
    </label>

    {session ? (
      <p className="mt-2 text-xs text-text-muted">Signed in as {session.user.email}</p>
    ) : (
      <form onSubmit={sendMagicLink} className="mt-2 flex flex-wrap items-center gap-2">
        <label htmlFor="magic-link-email" className="sr-only">Email address</label>
        <input
          id="magic-link-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={busy}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" variant="outline" size="sm" disabled={busy || !email.trim()}>
          {busy ? 'Sending…' : 'Send Magic Link'}
        </Button>
      </form>
    )}
    {sent && !session && (
      <p role="status" className="mt-2 text-xs text-text-muted">Check {email.trim()} for a sign-in link.</p>
    )}
    {error && <p role="alert" className="text-study-rose-500 text-xs">{error}</p>}
  </div>;
}

export async function requireAISession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in with your email magic link before using AI.');
  return data.session;
}
