"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const FINISHED = ["completed", "ended_early", "no_show", "withdrawn", "removed"];

/**
 * Editable start date for one worker.
 *
 * Saves on change rather than behind a button: it is a single field, and a
 * crew of twelve with different start dates would otherwise be twelve clicks
 * plus twelve saves. The date reverts visibly if the write fails.
 */
export function StartDateCell({
  placementId,
  stage,
  value,
}: {
  placementId: string;
  stage: string;
  value: string | null;
}) {
  const router = useRouter();
  const [date, setDate] = useState(value ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (FINISHED.includes(stage)) {
    return (
      <span className="mono" style={{ fontSize: 12.5 }}>
        {value ?? "—"}
      </span>
    );
  }

  function save(next: string) {
    const previous = date;
    setDate(next);
    setError(null);
    if (!next) return;

    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("customer_set_placement_start", {
        p_placement_id: placementId,
        p_start: next,
      });
      if (error) {
        setDate(previous);
        setError(error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <input
        type="date"
        value={date}
        disabled={pending}
        onChange={(e) => save(e.target.value)}
        aria-label="Start date for this worker"
        style={{
          padding: "4px 6px",
          border: "1.3px solid var(--line-strong)",
          background: "var(--paper)",
          fontSize: 12.5,
          width: 140,
        }}
      />
      {stage === "started" && (
        <div style={{ fontSize: 11, color: "var(--green)" }}>on site</div>
      )}
      {error && (
        <div style={{ fontSize: 11, color: "var(--brand-red)" }}>{error}</div>
      )}
    </>
  );
}
