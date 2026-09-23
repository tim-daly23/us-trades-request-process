import { type EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE, RECOVERY_WINDOW_SECONDS } from "@/lib/recovery";

/**
 * Landing point for links in Supabase auth emails.
 *
 * Uses the token_hash / verifyOtp form rather than the default
 * {{ .ConfirmationURL }}: that one returns the session in a URL fragment,
 * which never reaches the server, so a Server Component cannot see it. This
 * exchanges the token for a cookie session on the server, where the rest of
 * the app already looks for one.
 *
 * Redirects with next/navigation's redirect() rather than building a
 * NextResponse: the Supabase client writes its session cookies through the
 * cookies() store, and only that path is guaranteed to carry them onto a
 * response this handler did not construct itself.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only ever redirect to a path on this site. Taking the raw parameter would
  // turn the address in every auth email into an open redirect.
  const requested = searchParams.get("next") ?? "/";
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  if (!tokenHash || !type) redirect("/forgot-password?error=link");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) redirect("/forgot-password?error=link");

  if (type === "recovery") {
    (await cookies()).set(RECOVERY_COOKIE, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: RECOVERY_WINDOW_SECONDS,
    });
  }

  redirect(next);
}
