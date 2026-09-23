"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE } from "@/lib/recovery";

type Result = { ok: true } | { ok: false; error: string };

const MIN_LENGTH = 10;

/**
 * Set a new password without being asked for the old one.
 *
 * Gated on the recovery cookie, not merely on holding a session. Supabase's
 * updateUser is happy to change a password for anyone signed in, so without
 * this check an unattended browser would be a way to take an account over —
 * which is exactly what the Account screen's change-password form avoids by
 * demanding the current password. This path skips that demand, so it has to
 * prove something else: a token from the account's own inbox, presented in
 * the last few minutes.
 *
 * A server action rather than a client-side updateUser call, because a check
 * that runs in the browser is a suggestion.
 */
export async function setNewPassword(form: FormData): Promise<Result> {
  const jar = await cookies();
  if (jar.get(RECOVERY_COOKIE)?.value !== "1") {
    return {
      ok: false,
      error:
        "This reset link is no longer active. Request a new one from the sign-in page.",
    };
  }

  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (password.length < MIN_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_LENGTH} characters.` };
  }
  if (password !== confirm) {
    return { ok: false, error: "The two passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: "Your session expired. Request a new reset link.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };

  // One token, one change.
  jar.delete(RECOVERY_COOKIE);

  return { ok: true };
}
