import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Used for exactly one thing: creating auth accounts, which only the Auth
 * admin API can do. Every other agency write goes through the normal
 * request-scoped client, so RLS still adjudicates it.
 *
 * `server-only` makes importing this from a Client Component a build error —
 * this key must never reach a browser bundle.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local " +
        "(Supabase dashboard → Project Settings → API Keys → service_role).",
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function hasServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
