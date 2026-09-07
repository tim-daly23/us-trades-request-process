import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 *
 * Must be created per request — it closes over that request's cookies, so a
 * module-level singleton would leak one user's session into another's request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  // NEXT_PUBLIC_* values are inlined at build time, so a deployment built
  // without them has undefined here and createServerClient throws an opaque
  // error. Name the missing variable instead — the message reaches the Vercel
  // runtime log, where it is the difference between a five-minute fix and an
  // afternoon.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      `Supabase is not configured in this build: ${
        !url ? "NEXT_PUBLIC_SUPABASE_URL" : "NEXT_PUBLIC_SUPABASE_ANON_KEY"
      } is missing. Set it for the Production environment and redeploy — ` +
        "these values are compiled in at build time, so adding them to an " +
        "existing deployment does nothing until it is rebuilt.",
    );
  }

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot set cookies. Safe to ignore: the
            // middleware refreshes the session on every request, so the
            // rotated token is already persisted by the time we get here.
          }
        },
      },
    },
  );
}
