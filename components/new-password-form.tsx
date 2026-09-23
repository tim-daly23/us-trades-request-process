"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setNewPassword } from "@/app/reset-password/actions";

/**
 * The form behind a reset link.
 *
 * refresh() before push(): updateUser rotates the session cookies, and the
 * router's client cache may still be holding the entry it rendered under the
 * old ones.
 */
export function NewPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);

    start(async () => {
      const result = await setNewPassword(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
      router.push("/");
    });
  }

  if (done) {
    return (
      <div className="hint" style={{ margin: 0 }}>
        Password changed. Taking you to the portal…
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <label className="field">
        <span>
          New password <span className="req-star">*</span>
        </span>
        <input
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          autoFocus
        />
      </label>

      <label className="field">
        <span>
          Confirm new password <span className="req-star">*</span>
        </span>
        <input
          name="confirm"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </label>

      {error && (
        <div className="gate" style={{ marginBottom: 13 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary"
        style={{ width: "100%" }}
        disabled={pending}
      >
        {pending ? "Saving…" : "Set password and sign in"}
      </button>

      <div className="hint">
        At least 10 characters. This replaces the password on your account
        everywhere.
      </div>
    </form>
  );
}
