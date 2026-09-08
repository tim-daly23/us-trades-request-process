"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/agency/action-form";
import { createJob, updateJob, deleteJob } from "@/app/(portal)/jobs/actions";
import { formatMoney } from "@/lib/format";

export type Job = {
  id: string;
  job_number: string;
  date_created: string | null;
  status: string;
  end_customer: string | null;
  description: string | null;
  site_name: string | null;
  location: string | null;
  gps_coordinates: string | null;
  project_manager: string | null;
  site_contact_name: string | null;
  site_contact_phone: string | null;
  per_diem_rate: number | string | null;
  twic_required: boolean;
  notes: string | null;
};

const STATUSES = ["Pending", "Active", "On Hold", "Complete", "Cancelled"];

const TONE: Record<string, string> = {
  Active: "approved",
  Pending: "pending",
  "On Hold": "pending",
  Complete: "inactive",
  Cancelled: "declined",
};

/**
 * The job log.
 *
 * Search is client-side and deliberately loose: it matches across job number,
 * end customer, description, site, location and both contacts at once, because
 * people look a job up by whatever they happen to remember about it.
 */
export function JobLog({
  jobs,
  canWrite,
  customerId,
}: {
  jobs: Job[];
  canWrite: boolean;
  /** Set when staff are adding on a customer's behalf; a customer user's own
   *  tenant is implied by their profile. */
  customerId?: string;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("open");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (status === "open" && ["Complete", "Cancelled"].includes(j.status))
        return false;
      if (status !== "open" && status !== "all" && j.status !== status) return false;
      if (!needle) return true;
      return [
        j.job_number, j.end_customer, j.description, j.site_name,
        j.location, j.project_manager, j.site_contact_name,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [jobs, q, status]);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Job log</h2>
            <div className="sub">
              {rows.length} of {jobs.length} shown
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search job #, customer, site…"
              style={control(230)}
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={control(150)}
            >
              <option value="open">Open jobs</option>
              <option value="all">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {canWrite && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setAdding((a) => !a)}
              >
                {adding ? "Cancel" : "Add job"}
              </button>
            )}
          </div>
        </div>

        {adding && canWrite && (
          <div
            style={{
              border: "1px solid var(--line)",
              padding: 16,
              marginBottom: 16,
              background: "var(--paper)",
            }}
          >
            <h3 style={{ fontSize: 16, marginBottom: 10 }}>New job</h3>
            <ActionForm action={createJob} submitLabel="Add job" resetOnSuccess>
              {customerId && (
                <input type="hidden" name="customer_id" value={customerId} />
              )}
              <JobFields />
            </ActionForm>
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ minWidth: 1340 }}>
            <thead>
              <tr>
                <th style={{ width: 74 }}>Job #</th>
                <th style={{ width: 104 }}>Status</th>
                <th style={{ width: 140 }}>Customer</th>
                <th style={{ minWidth: 240 }}>Description</th>
                <th style={{ width: 180 }}>Site</th>
                <th style={{ width: 130 }}>PM</th>
                <th style={{ width: 160 }}>Site contact</th>
                <th style={{ width: 92 }}>Per diem</th>
                <th style={{ width: 64 }}>TWIC</th>
                {canWrite && <th style={{ width: 78 }} />}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={canWrite ? 10 : 9}>
                    {jobs.length === 0
                      ? "No jobs logged yet."
                      : "Nothing matches that search."}
                  </td>
                </tr>
              ) : (
                rows.map((j) => (
                  <tr key={j.id}>
                    <td className="mono" style={{ fontWeight: 500 }}>
                      {j.job_number}
                    </td>
                    <td>
                      <span className={`badge ${TONE[j.status] ?? "inactive"}`}>
                        {j.status}
                      </span>
                    </td>
                    <td>{j.end_customer ?? "—"}</td>
                    <td style={{ color: "var(--steel)" }}>{j.description ?? "—"}</td>
                    <td style={{ color: "var(--steel)" }}>
                      {j.site_name ?? "—"}
                      {j.location && (
                        <div style={{ fontSize: 11.5, color: "var(--steel-dim)" }}>
                          {j.location}
                        </div>
                      )}
                    </td>
                    <td style={{ color: "var(--steel)" }}>
                      {j.project_manager ?? "—"}
                    </td>
                    <td style={{ fontSize: 12.5 }}>
                      {j.site_contact_name ?? "—"}
                      {j.site_contact_phone && (
                        <div className="mono" style={{ fontSize: 11.5, color: "var(--steel)" }}>
                          {j.site_contact_phone}
                        </div>
                      )}
                    </td>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>
                      {formatMoney(j.per_diem_rate)}
                    </td>
                    <td>
                      {j.twic_required ? (
                        <span className="badge submitted">Yes</span>
                      ) : (
                        <span style={{ color: "var(--steel-dim)" }}>No</span>
                      )}
                    </td>
                    {canWrite && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => setEditing(editing === j.id ? null : j.id)}
                        >
                          {editing === j.id ? "Close" : "Edit"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canWrite && editing && (
        <EditPanel
          job={jobs.find((j) => j.id === editing)!}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function EditPanel({ job, onClose }: { job: Job; onClose: () => void }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>
            Job <span className="mono">{job.job_number}</span>
          </h2>
        </div>
        <button type="button" className="action-btn" onClick={onClose}>
          Close
        </button>
      </div>

      <ActionForm action={updateJob} submitLabel="Save job">
        <input type="hidden" name="id" value={job.id} />
        <JobFields job={job} />
      </ActionForm>

      <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <ActionForm
          action={deleteJob}
          submitLabel="Remove from log"
          submitClass="action-btn"
          confirm={`Remove job ${job.job_number} from the log?`}
        >
          <input type="hidden" name="id" value={job.id} />
        </ActionForm>
        <div className="hint">
          Removing hides it. A job number that has appeared on a request stays
          resolvable.
        </div>
      </div>
    </div>
  );
}

function JobFields({ job }: { job?: Job }) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "0 14px",
        }}
      >
        <label className="field">
          <span>
            Job # <span className="req-star">*</span>
          </span>
          <input name="job_number" required defaultValue={job?.job_number ?? ""} />
        </label>
        <label className="field">
          <span>Date created</span>
          <input type="date" name="date_created" defaultValue={job?.date_created ?? ""} />
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" defaultValue={job?.status ?? "Pending"}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Customer</span>
          <input
            name="end_customer"
            defaultValue={job?.end_customer ?? ""}
            placeholder="Energy Transfer"
          />
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}>
          <span>Job description</span>
          <input
            name="description"
            defaultValue={job?.description ?? ""}
            placeholder="Meter Station Analyzer SOW"
          />
        </label>
        <label className="field">
          <span>Site name</span>
          <input name="site_name" defaultValue={job?.site_name ?? ""} />
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}>
          <span>Location / address</span>
          <input name="location" defaultValue={job?.location ?? ""} />
        </label>
        <label className="field">
          <span>GPS</span>
          <input name="gps_coordinates" defaultValue={job?.gps_coordinates ?? ""} />
        </label>
        <label className="field">
          <span>Project manager</span>
          <input name="project_manager" defaultValue={job?.project_manager ?? ""} />
        </label>
        <label className="field">
          <span>Site contact</span>
          <input name="site_contact_name" defaultValue={job?.site_contact_name ?? ""} />
        </label>
        <label className="field">
          <span>Contact phone</span>
          <input
            name="site_contact_phone"
            type="tel"
            defaultValue={job?.site_contact_phone ?? ""}
          />
        </label>
        <label className="field">
          <span>Per diem</span>
          <input
            name="per_diem_rate"
            type="number"
            min="0"
            step="0.01"
            defaultValue={job?.per_diem_rate ? Number(job.per_diem_rate) : ""}
          />
        </label>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          fontSize: 12.5,
        }}
      >
        <input
          type="checkbox"
          name="twic_required"
          defaultChecked={job?.twic_required ?? false}
          style={{ width: 16, height: 16 }}
        />
        <span>TWIC required</span>
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea name="notes" rows={2} defaultValue={job?.notes ?? ""} />
      </label>
    </>
  );
}

function control(width: number): React.CSSProperties {
  return {
    width,
    padding: "7px 9px",
    border: "1.5px solid var(--line-strong)",
    background: "var(--panel)",
    fontSize: 12.5,
  };
}
