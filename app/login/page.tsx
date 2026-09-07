"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/brand-mark";
import { DEFAULT_BRANDING } from "@/lib/branding";

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
    <div className="flex min-h-screen flex-col bg-white">
      <div className="h-1 shrink-0 bg-accent" />

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Brand panel */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-brand p-10 lg:w-[46%] lg:p-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.055]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, #FFFFFF 0px, #FFFFFF 14px, transparent 14px, transparent 34px)",
            }}
          />

          <div className="relative">
            <BrandMark
              logoUrl={DEFAULT_BRANDING.logoUrl}
              name="US Trades"
              size="lg"
              tagline="Industrial Craft Labor"
            />
          </div>

          <div className="relative mt-14 flex flex-col gap-5 lg:mt-0">
            <h2 className="text-[32px] font-medium leading-[1.14] tracking-[-0.018em] text-white lg:text-[40px]">
              Request crews.
              <br />
              Track every seat.
            </h2>
            <p className="max-w-[400px] text-[15px] leading-[1.6] text-[#AEBCCC]">
              Submit manpower requests against your saved sites and follow each
              candidate from submittal to badged and on site.
            </p>
          </div>

          <div className="relative mt-14 border-t border-white/[0.13] pt-5 lg:mt-0">
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#8496AA]">
              Pipefitters · Welders · Boilermakers · Millwrights · Electricians
            </p>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex flex-1 items-center justify-center bg-background p-8">
          <form
            onSubmit={onSubmit}
            className="flex w-[396px] max-w-full flex-col gap-7"
          >
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
                Customer portal
              </span>
              <h1 className="text-[26px] font-medium tracking-[-0.015em]">
                Sign in to your portal
              </h1>
            </div>

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-[7px]">
                <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
                  Work email
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-[7px]">
                <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
                  Password
                </span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            {error && (
              <p className="bg-danger-soft px-3 py-2.5 text-[13px] text-danger-soft-fg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="h-[46px] bg-accent text-[14.5px] font-medium text-accent-fg transition hover:brightness-95 disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>

            <div className="border-t border-line-strong pt-4">
              <p className="text-[12.5px] leading-[1.55] text-muted">
                Need access for someone on your team? Your account admin can
                invite them under Team.
              </p>
            </div>
          </form>
        </div>
      </div>

      <div className="flex h-[46px] shrink-0 items-center justify-between border-t border-line-strong bg-white px-7">
        <span className="num text-[11.5px] text-muted-3">
          portal.ustrades.com
        </span>
        <span className="text-[11.5px] text-muted-3">
          © {new Date().getFullYear()} US Trades
        </span>
      </div>
    </div>
  );
}

const inputClass =
  "h-11 border border-line-strong bg-white px-[13px] text-[14.5px] outline-none transition focus:border-brand focus:shadow-[0_0_0_3px_rgba(38,55,76,0.09)]";
