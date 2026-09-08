"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: string;
  job_number: string;
  end_customer: string | null;
  description: string | null;
};

/**
 * The job number on a request, changeable at any status.
 *
 * A site can carry many job numbers over the years, so this is never inferred —
 * someone assigns it, often after the request has already gone in. Saves on
 * change and reverts if the write is refused.
 */
export function RequestJobPicker({
  requisitionId,
  jobs,
  value,
  canEdit,
}: {
  requisitionId: string;
  jobs: Job[];
  value: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [jobId, setJobId] = useState(value ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const current = jobs.find((j) => j.id === jobId);

  if (!canEdit) {
    return (
      <span style={{ fontSize: 13.5 }}>
        {current
          ? [current.job_number, current.end_customer].filter(Boolean).join(" · ")
          : "—"}
      </span>
    );
  }

  function save(next: string) {
    const previous = jobId;
    setJobId(next);
    setError(null);
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("set_request_job", {
        p_requisition_id: requisitionId,
        p_job_id: next === "" ? null : next,
      });
      if (error) {
        setJobId(previous);
        setError(error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <select
        value={jobId}
        disabled={pending}
        onChange={(e) => save(e.target.value)}
        aria-label="Job number for this request"
        style={{
          padding: "4px 6px",
          border: "1.3px solid var(--line-strong)",
          background: "var(--paper)",
          fontSize: 12.5,
          maxWidth: 230,
        }}
      >
        <option value="">
          {jobs.length === 0 ? "No jobs logged" : "Not assigned"}
        </option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {[j.job_number, j.end_customer, j.description]
              .filter(Boolean)
              .join(" · ")}
          </option>
        ))}
      </select>
      {error && (
        <div style={{ fontSize: 11, color: "var(--brand-red)" }}>{error}</div>
      )}
    </>
  );
}
