import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const e2eLoginInput = z.object({
  secret: z.string().min(32).max(256),
});

async function constantTimeSecretMatch(provided: string, expected: string) {
  const encoder = new TextEncoder();
  const [providedDigest, expectedDigest] = await Promise.all([
    globalThis.crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    globalThis.crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const providedBytes = new Uint8Array(providedDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < providedBytes.length; index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

/**
 * Production-safe-by-default QA login.
 * The shared secret and bot password are read only in this server handler.
 * The browser receives a Supabase session only after the secret is verified.
 */
export const e2eTestLogin = createServerFn({ method: "POST" })
  .inputValidator(e2eLoginInput)
  .handler(async ({ data }) => {
    const enabled = process.env["E2E_BYPASS_ENABLED"] === "true";
    const expectedSecret = process.env["E2E_BYPASS_SECRET"];
    const testPassword = process.env["E2E_TEST_PASSWORD"];

    if (!enabled || !expectedSecret || !testPassword || expectedSecret.length < 32) {
      return { success: false as const };
    }

    const isAuthorized = await constantTimeSecretMatch(data.secret, expectedSecret);
    if (!isAuthorized) return { success: false as const };

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabasePublishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!supabaseUrl || !supabasePublishableKey) {
      return { success: false as const };
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: "bot@studysmartly.test",
        password: testPassword,
      });

      if (error || !authData.session) {
        // Fail closed without returning Supabase's account or credential details.
        return { success: false as const };
      }

      return {
        success: true as const,
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
      };
    } catch {
      return { success: false as const };
    }
  });
