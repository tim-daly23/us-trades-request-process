import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next 16 renamed the middleware file convention to "proxy". Keeping the old
// name still built locally but failed at runtime on Vercel with
// MIDDLEWARE_INVOCATION_FAILED — the deprecated convention and the platform's
// newer runtime disagree about what to invoke.
export default async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Auth routes are handled
     * inside updateSession rather than excluded here, so that a signed-in user
     * hitting /login still gets their session refreshed.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
