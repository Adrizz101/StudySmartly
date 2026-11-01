import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type AuthStep = "email" | "otp";
type EmailMode = "code" | "password";

export function AuthScreen() {
  const [step, setStep] = useState<AuthStep>("email");
  const [emailMode, setEmailMode] = useState<EmailMode>("code");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function requestCode(address: string) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: address,
        options: {
          // This app supports both first-time registration and returning users.
          shouldCreateUser: true,
        },
      });

      if (authError) {
        setError(authError.message);
        return false;
      }

      setNotice("A new verification code has been sent. Check your inbox and spam folder.");
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send the verification code. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    const sent = await requestCode(normalizedEmail);
    if (sent) {
      setEmail(normalizedEmail);
      setToken("");
      setStep("otp");
      setNotice("Check your email for the 6-digit sign-in code.");
    }
  }

  async function passwordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) setError("Unable to sign in with that email and password.");
      // On success, AuthGate observes the new Supabase session and opens the app.
    } catch {
      setError("Unable to sign in with that email and password.");
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    await requestCode(email);
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedToken = token.trim();
    if (!/^\d{6}$/.test(normalizedToken)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const { error: authError } = await supabase.auth.verifyOtp({
        email,
        token: normalizedToken,
        type: "email",
      });

      if (authError) setError(authError.message);
      // On success, AuthGate observes the new Supabase session and opens the app.
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "Could not verify the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    setStep("email");
    setToken("");
    setError("");
    setNotice("");
  }

  function toggleEmailMode() {
    setEmailMode((current) => current === "code" ? "password" : "code");
    setPassword("");
    setError("");
    setNotice("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-lg">
        <img src="/logo.jpg" alt="StudySmartly" className="mix-blend-screen w-56 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-text">Welcome to StudySmartly</h1>
        {step === "email" ? (
          <>
            <p className="mt-2 text-sm text-text-muted">
              {emailMode === "code"
                ? "Enter your email to receive a 6-digit sign-in code. No magic link is needed."
                : "Enter your email and password to sign in."}
            </p>
            <form onSubmit={emailMode === "code" ? sendCode : passwordLogin} className="mt-6 space-y-4">
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
              {emailMode === "password" && (
                <>
                  <label htmlFor="auth-password" className="sr-only">Password</label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={busy}
                    className="learning-input w-full"
                  />
                  <p className="text-xs text-text-dim -mt-2">
                    First time here? Log in with an email code first to set your password in Settings.
                  </p>
                </>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={busy || !email.trim() || (emailMode === "password" && !password)}
              >
                {busy
                  ? (emailMode === "code" ? "Sending…" : "Logging in…")
                  : (emailMode === "code" ? "Send Code" : "Log In")}
              </Button>
              <button
                type="button"
                onClick={toggleEmailMode}
                disabled={busy}
                className="w-full text-center text-xs text-text-muted underline-offset-4 hover:text-text hover:underline disabled:opacity-50"
              >
                {emailMode === "code" ? "Log in with Password" : "Use Email Code instead"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-text-muted">
              Enter the 6-digit code sent to <strong>{email}</strong>.
            </p>
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
                onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={busy}
                className="learning-input w-full text-center tracking-[0.4em]"
              />
              <Button type="submit" className="w-full" disabled={busy || token.length !== 6}>
                {busy ? "Verifying…" : "Verify Code"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={resendCode}
                disabled={busy}
              >
                Resend code
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={goBack}
                disabled={busy}
              >
                Change email
              </Button>
            </form>
          </>
        )}
        {notice && (
          <p role="status" className="mt-4 text-sm text-text-muted">
            {notice}
          </p>
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
