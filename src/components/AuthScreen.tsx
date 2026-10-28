import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSent(false);
    setError("");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (authError) setError(authError.message);
    else setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-text">Welcome to StudySmart</h1>
        <p className="mt-2 text-sm text-text-muted">Enter your email to receive a secure sign-in link.</p>
        <form onSubmit={sendMagicLink} className="mt-6 space-y-4">
          <label htmlFor="auth-email" className="sr-only">Email address</label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            className="learning-input w-full"
          />
          <Button type="submit" className="w-full" disabled={busy || !email.trim()}>
            {busy ? "Sending…" : "Send Magic Link"}
          </Button>
        </form>
        {sent && <p role="status" className="mt-4 text-sm text-text-muted">Check your email for a sign-in link.</p>}
        {error && <p role="alert" className="mt-4 text-sm text-study-rose-500">{error}</p>}
      </section>
    </main>
  );
}
