"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const READY_TO_START = ["customer_approved", "onboarding", "confirmed"];

/**
 * On site / off site, from the customer's own screen.
 *
 * The customer sees the gate before anyone else does, so they record it. Both
 * calls go through definer RPCs — placements is agency-write-only, and that
 * stays true.
 */
export function OnSiteControls({
  placementId,
  stage,
  workerName,
}: {
  placementId: string;
  stage: string;
  workerName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  function markOnSite() {
    setError(null);
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("customer_mark_on_site", {
        p_placement_id: placementId,
      });
      if (error) {
        setError(error.message);
        return;
      }
      router.refresh();
    });
  }

  function markOffSite(reason: string) {
    setError(null);
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("customer_mark_off_site", {
        p_placement_id: placementId,
        p_reason: reason,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setAsking(false);
      router.refresh();
    });
  }

  return (
    <>
      {READY_TO_START.includes(stage) && (
        <button
          type="button"
          className="action-btn"
          disabled={pending}
          onClick={markOnSite}
        >
          {pending ? "Working…" : "Mark on site"}
        </button>
      )}

      {stage === "started" && (
        <button
          type="button"
          className="action-btn"
          disabled={pending}
          onClick={() => setAsking(true)}
        >
          Mark off site
        </button>
      )}

      {error && (
        <div style={{ fontSize: 11.5, color: "var(--brand-red)", marginTop: 4 }}>
          {error}
        </div>
      )}

      {asking && (
        <OffSiteDialog
          workerName={workerName}
          pending={pending}
          onCancel={() => setAsking(false)}
          onConfirm={markOffSite}
        />
      )}
    </>
  );
}

function OffSiteDialog({
  workerName,
  pending,
  onCancel,
  onConfirm,
}: {
  workerName: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [rof, setRof] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [other, setOther] = useState("");
  const [warn, setWarn] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parts: string[] = [];
    if (rof) parts.push("ROF");
    if (transfer) parts.push("Transfer");
    if (other.trim()) parts.push(`Other: ${other.trim()}`);

    if (parts.length === 0) {
      setWarn("Choose a reason, or type one under Other.");
      return;
    }
    onConfirm(parts.join(" · "));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Reason for taking ${workerName} off site`}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,41,74,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        onSubmit={submit}
        className="panel"
        style={{ width: 460, maxWidth: "100%", maxHeight: "90vh", overflow: "auto" }}
      >
        <div className="panel-head">
          <div>
            <h2>What is the reason?</h2>
            <div className="sub">
              Taking {workerName} off site.
            </div>
          </div>
        </div>

        <label
          style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 10 }}
        >
          <input
            type="checkbox"
            checked={rof}
            onChange={(e) => setRof(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span>ROF</span>
        </label>

        <label
          style={{ display: "flex", gap: 9, alignItems: "center", marginBottom: 14 }}
        >
          <input
            type="checkbox"
            checked={transfer}
            onChange={(e) => setTransfer(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span>Transfer</span>
        </label>

        <label className="field">
          <span>Other:</span>
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="Anything else worth recording"
          />
        </label>

        {warn && (
          <div
            style={{
              background: "var(--brand-red-dim)",
              borderLeft: "3px solid var(--brand-red)",
              padding: "9px 12px",
              fontSize: 12.5,
              marginBottom: 12,
            }}
          >
            {warn}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Mark off site"}
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
