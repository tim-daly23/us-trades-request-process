"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type ActionResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string };

/**
 * Form wrapper for the agency screens.
 *
 * Server actions do the work; this only carries the pending state, surfaces
 * the error string, and refreshes the route on success. Keeping it in one
 * place means every agency form reports failure the same way instead of each
 * one inventing its own.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  submitClass = "btn-primary",
  resetOnSuccess = false,
  confirm,
  onSuccess,
  inline = false,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children?: React.ReactNode;
  submitLabel: string;
  submitClass?: string;
  resetOnSuccess?: boolean;
  /** Ask before running — for destructive or hard-to-undo actions. */
  confirm?: string;
  onSuccess?: (data: unknown) => void;
  inline?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirm && !window.confirm(confirm)) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const result = await action(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.("data" in result ? result.data : undefined);
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      style={inline ? { display: "inline" } : undefined}
    >
      {children}
      {error && (
        <div className="gate" style={{ margin: "10px 0" }}>
          {error}
        </div>
      )}
      <button type="submit" className={submitClass} disabled={pending}>
        {pending ? "Working…" : submitLabel}
      </button>
    </form>
  );
}
