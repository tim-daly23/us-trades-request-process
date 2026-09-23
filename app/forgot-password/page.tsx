"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const linkFailed = params.get("error") === "link";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email);

    // Always the same answer, whether or not that address has an account.
    // Anything else turns this form into a way to find out who US Trades
    // works with — one request per guess, no login required.
    setSent(true);
    setBusy(false);
  }

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
              <h2>Reset your password</h2>
              <div className="sub">
                We will email you a link to set a new one.
              </div>
            </div>
          </div>

          {linkFailed && (
            <div className="gate" style={{ marginBottom: 13 }}>
              That link has expired or has already been used. Request a new one
              below — they are good for one use, for a short time.
            </div>
          )}

          {sent ? (
            <>
              <div
                className="panel"
                style={{
                  background: "var(--green-dim)",
                  borderColor: "var(--green)",
                  marginBottom: 14,
                }}
              >
                <strong
                  style={{ fontFamily: "var(--font-barlow)", fontSize: 16 }}
                >
                  Check your email
                </strong>
                <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6 }}>
                  If <span className="mono">{email}</span> has a portal account,
                  a reset link is on its way. It expires shortly and works once.
                </p>
              </div>
              <div className="hint">
                Nothing after a few minutes? Check spam, then contact your US
                Trades rep — the address may not be the one on the account.
              </div>
            </>
          ) : (
            <form onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="email">Work email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: "100%" }}
                disabled={busy}
              >
                {busy ? "Sending…" : "Email me a reset link"}
              </button>
            </form>
          )}

          <div className="hint">
            <Link href="/login" className="link">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
