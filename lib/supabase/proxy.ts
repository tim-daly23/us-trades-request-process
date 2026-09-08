import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { normalizeSupabaseUrl } from "./url";

/** Paths reachable without a session. */
const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * Refreshes the Supabase session on every request and gates private routes.
 *
 * Access tokens are short-lived; without this the user is silently signed out
 * mid-session. It also re-mints the token, which is what picks up any change
 * the custom access token hook makes to app_metadata — so a user's tenant or
 * role change propagates on the next request rather than at next login.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // NEXT_PUBLIC_* values are compiled in at build time, so a deployment built
  // before they were configured has them undefined. Constructing the client
  // would throw, and because middleware runs before every route that takes the
  // entire site down with MIDDLEWARE_INVOCATION_FAILED — including the login
  // page, which needs no session at all.
  //
  // Fail open to the public routes instead: the app is misconfigured either
  // way, but the failure stays legible rather than a blanket 500.
  if (!url || !anonKey) {
    console.error(
      "Supabase environment variables are missing in this build. " +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.",
    );
    return response;
  }

  const supabase = createServerClient(
    normalizeSupabaseUrl(url),
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser(), not getSession(): getSession trusts the cookie as-is, while
  // getUser revalidates the token against the auth server. Middleware is a
  // security boundary, so it must not trust unverified cookie contents.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}
