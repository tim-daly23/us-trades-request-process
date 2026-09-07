"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/brand-mark";

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
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-xl border border-line bg-surface p-8 shadow-lg"
      >
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <BrandMark logoUrl={null} name="US Trades" variant="onSurface" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Manpower portal
          </h1>
          <p className="mt-1 text-sm text-muted">
            Sign in to submit and track craft requests.
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-line bg-background px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-line bg-background px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        {error && (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
