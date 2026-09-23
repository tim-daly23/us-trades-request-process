import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE } from "@/lib/recovery";
import { NewPasswordForm } from "@/components/new-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session at all means the link was never verified — send them to ask for
  // a new one rather than to the sign-in page they just came from.
  if (!user) redirect("/forgot-password?error=link");

  const armed = (await cookies()).get(RECOVERY_COOKIE)?.value === "1";

  return (
    <>
      <div className="brand-stripe" />
      <div className="shell" style={{ maxWidth: 520 }}>
        <div className="masthead">
          <div className="brand">
            <Image
              className="logo-mark"
              src="/us-trades-logo.png"
              alt="US Trades LLC logo"
              width={52}
              height={52}
              priority
            />
            <div>
              <h1>US Trades</h1>
              <p>Manpower Portal</p>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Choose a new password</h2>
              <div className="sub">
                For <span className="mono">{user.email}</span>.
              </div>
            </div>
          </div>

          {armed ? (
            <NewPasswordForm />
          ) : (
            <>
              <div className="gate" style={{ marginBottom: 13 }}>
                This reset link has already been used, or it has been sitting
                open too long. Request a fresh one — they last a few minutes and
                work once.
              </div>
              <Link href="/forgot-password" className="btn-primary">
                Request a new link
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
