"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// useSearchParams opts the tree into client-side rendering, which Next
// requires be wrapped in a Suspense boundary or the build fails.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }

    // Full navigation rather than router.push: the session cookie was just
    // written client-side, and Server Components need a fresh request to see it.
    window.location.href = params.get("next") ?? "/";
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
              <h2>Sign in</h2>
              <div className="sub">
                Submit manpower requests and follow every seat from submittal to
                on site.
              </div>
            </div>
          </div>

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

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="gate" style={{ marginBottom: 13 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              style={{ width: "100%" }}
              disabled={busy}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>

            <div className="hint">
              Need access for someone on your team? Your account admin can
              invite them. Trouble signing in? Contact your US Trades rep.
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
