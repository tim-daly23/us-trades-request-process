"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Name and phone, written through update_own_profile.
 *
 * That RPC touches only those two columns for the caller's own row — a plain
 * RLS policy would also permit changing customer_role, since row-level
 * security cannot restrict columns.
 */
export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [tel, setTel] = useState(phone);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("update_own_profile", {
        p_full_name: name,
        p_phone: tel,
      });
      if (error) {
        setMsg({ ok: false, text: error.message });
        return;
      }
      setMsg({ ok: true, text: "Saved." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "0 14px",
        }}
      >
        <label className="field">
          <span>
            Full name <span className="req-star">*</span>
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span>Phone</span>
          <input
            value={tel}
            onChange={(e) => setTel(e.target.value)}
            type="tel"
            placeholder="(409) 555-0142"
          />
        </label>
      </div>

      {msg && <Notice ok={msg.ok} text={msg.text} />}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}

/**
 * Password change.
 *
 * Supabase's updateUser does not ask for the current password — a session is
 * enough. That means an unattended, signed-in browser could be used to lock the
 * real owner out. So the current password is verified first by signing in with
 * it; only then is the new one set.
 */
export function PasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (next.length < 10) {
      setMsg({ ok: false, text: "Use at least 10 characters." });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: "The two new passwords do not match." });
      return;
    }
    if (next === current) {
      setMsg({ ok: false, text: "The new password is the same as the current one." });
      return;
    }

    start(async () => {
      const supabase = createClient();

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (authError) {
        setMsg({ ok: false, text: "That current password is not right." });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        setMsg({ ok: false, text: error.message });
        return;
      }

      setCurrent("");
      setNext("");
      setConfirm("");
      setMsg({
        ok: true,
        text: "Password changed. It takes effect everywhere you sign in next.",
      });
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "0 14px",
        }}
      >
        <label className="field">
          <span>
            Current password <span className="req-star">*</span>
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>
            New password <span className="req-star">*</span>
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>
            Confirm new password <span className="req-star">*</span>
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
      </div>

      {msg && <Notice ok={msg.ok} text={msg.text} />}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Changing…" : "Change password"}
      </button>

      <div className="hint">
        At least 10 characters. Your current password is checked before the
        change, so a signed-in browser left unattended cannot be used to lock
        you out.
      </div>
    </form>
  );
}

function Notice({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      style={{
        background: ok ? "var(--green-dim)" : "var(--brand-red-dim)",
        borderLeft: `3px solid ${ok ? "var(--green)" : "var(--brand-red)"}`,
        padding: "10px 14px",
        margin: "0 0 12px",
        fontSize: 12.5,
      }}
    >
      {text}
    </div>
  );
}
