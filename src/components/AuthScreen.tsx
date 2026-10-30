import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type AuthStep = "email" | "otp";

export function AuthScreen() {
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;

    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
    });
    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setEmail(normalizedEmail);
    setStep("otp");
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedToken = token.trim();
    if (normalizedToken.length !== 6) return;

    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.verifyOtp({
      email,
      token: normalizedToken,
      type: "email",
    });
    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }
  }

  function goBack() {
    setStep("email");
    setToken("");
    setError("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-text">Welcome to StudySmart</h1>
        {step === "email" ? (
          <>
            <p className="mt-2 text-sm text-text-muted">
              Enter your email to receive a secure sign-in code.
            </p>
            <form onSubmit={sendCode} className="mt-6 space-y-4">
              <label htmlFor="auth-email" className="sr-only">
                Email address
              </label>
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
                {busy ? "Sending…" : "Send Code"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-text-muted">Enter the 6-digit code sent to {email}.</p>
            <form onSubmit={verifyCode} className="mt-6 space-y-4">
              <label htmlFor="auth-otp" className="sr-only">
                6-digit verification code
              </label>
              <input
                id="auth-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder="123456"
                value={token}
                onChange={(event) => setToken(event.target.value.replace(/\\D/g, "").slice(0, 6))}
                disabled={busy}
                className="learning-input w-full text-center tracking-[0.4em]"
              />
              <Button type="submit" className="w-full" disabled={busy || token.length !== 6}>
                {busy ? "Verifying…" : "Verify Code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={goBack}
                disabled={busy}
              >
                Back
              </Button>
            </form>
          </>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-study-rose-500">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
