import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components.
 *
 * Uses the anon key, which is public by design — it ships in the browser
 * bundle. It grants no authority on its own: every query it makes is still
 * filtered by RLS against the caller's JWT. The service role key must never
 * appear in this file or anywhere under app/.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
