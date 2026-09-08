import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  updateRequisition,
  setRequisitionStatus,
  addRequisitionLine,
  updateRequisitionLine,
  addPlacement,
  setPlacementStage,
  removePlacement,
  deleteRequisition,
} from "@/app/agency/ops-actions";
import { ActionForm } from "@/components/agency/action-form";
import { StatusBadge, UrgencyBadge } from "@/components/status-badge";
import { FillProgress } from "@/components/fill-progress";
import { requisitionLabel } from "@/lib/format";

/**
 * Stage order for the picker. Matches the enum, and the divider marks the line
 * the customer can see across — anything at or past submitted_to_customer is
 * visible to them, which the database enforces by trigger.
 */
const STAGES = [
  { value: "identified", label: "Identified", internal: true },
  { value: "contacted", label: "Contacted", internal: true },
  { value: "screening", label: "Screening", internal: true },
  { value: "credential_review", label: "Credential review", internal: true },
  { value: "submitted_to_customer", label: "→ Submitted to customer" },
  { value: "customer_reviewing", label: "Customer reviewing" },
  { value: "customer_approved", label: "Customer approved" },
  { value: "customer_declined", label: "Customer declined" },
  { value: "onboarding", label: "Onboarding / badging" },
  { value: "confirmed", label: "Confirmed" },
  { value: "started", label: "Started on site" },
  { value: "completed", label: "Completed" },
  { value: "ended_early", label: "Ended early" },
  { value: "no_show", label: "No show" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "removed", label: "Removed" },
];

/**
 * Only the transitions a person actually decides.
 *
 * Partially filled and Filled are derived from the placements rather than set
 * by hand — see lib/request-status.ts — so there is nothing here to move a
 * request through the middle of its life. Acknowledging is a commitment;
 * closing and cancelling are endings. Everything between is just the counts.
 */
const STATUS_ACTIONS = [
  { value: "acknowledged", label: "Acknowledge" },
  { value: "completed", label: "Close as completed" },
];

type Line = {
  id: string;
  line_number: number;
  quantity: number;
  filled_count: number;
  onboarding_count: number;
  status: string;
  bill_rate: number | string | null;
  target_pay_rate: number | string | null;
  notes: string | null;
  craft: { name: string } | null;
  level: { name: string } | null;
};

type Placement = {
  id: string;
  requisition_line_id: string;
  stage: string;
  is_customer_visible: boolean;
  credential_ready: boolean;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  actual_start_date: string | null;
  worker: { id: string; first_name: string; last_name: string; phone: string | null } | null;
};

const cellControl: React.CSSProperties = {
  padding: "4px 6px",
  border: "1.3px solid var(--line-strong)",
  background: "var(--paper)",
  fontSize: 12.5,
};

export default async function ManageRequisition({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAgency();
  const supabase = await createClient();

  const { data: req } = await supabase
    .from("requisitions")
    .select(
      `*, customer:customers(display_name, slug), site:sites(name, city, state),
        job:customer_jobs(id, job_number, end_customer)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!req) notFound();

  const [
    { data: lines },
    { data: placements },
    { data: workers },
    { data: crafts },
    { data: levels },
    { data: staff },
    { data: jobs },
  ] = await Promise.all([
    supabase
      .from("requisition_lines")
      .select(
        `id, line_number, quantity, filled_count, onboarding_count, status,
         bill_rate, target_pay_rate, notes,
         craft:crafts(name), level:levels(name)`,
      )
      .eq("requisition_id", id)
      .order("line_number")
      .returns<Line[]>(),
    supabase
      .from("placements")
      .select(
        `id, requisition_line_id, stage, is_customer_visible, credential_ready,
         scheduled_start_date, scheduled_end_date, actual_start_date,
         worker:workers(id, first_name, last_name, phone)`,
      )
      .eq("requisition_id", id)
      .returns<Placement[]>(),
    supabase
      .from("workers")
      .select("id, first_name, last_name, status")
      .is("deleted_at", null)
      .eq("do_not_return", false)
      .order("last_name"),
    supabase.from("crafts").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("levels").select("id, name").eq("is_active", true).order("rank"),
    supabase
      .from("app_users")
      .select("id, full_name, email")
      .eq("user_type", "agency")
      .eq("is_active", true)
      .order("email"),
    supabase
      .from("customer_jobs")
      .select("id, job_number, end_customer")
      .eq("customer_id", req.customer_id)
      .is("deleted_at", null)
      .order("job_number", { ascending: false }),
  ]);

  const byLine = new Map<string, Placement[]>();
  for (const p of placements ?? []) {
    byLine.set(p.requisition_line_id, [
      ...(byLine.get(p.requisition_line_id) ?? []),
      p,
    ]);
  }

  const customer = Array.isArray(req.customer) ? req.customer[0] : req.customer;
  const job = Array.isArray(req.job) ? req.job[0] : req.job;
  const site = Array.isArray(req.site) ? req.site[0] : req.site;

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <Link
          href="/agency"
          style={{
            fontSize: 12.5,
            color: "var(--steel)",
            textDecoration: "none",
            borderBottom: "1px dotted var(--steel)",
          }}
        >
          ← All requests
        </Link>
      </div>

      {/* ------------------------------------------------ status control */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="mono" style={{ fontSize: 12.5, color: "var(--steel)" }}>
              {req.req_number}
            </div>
            <h2>
              {requisitionLabel({
                title: req.title,
                projectName: req.project_name,
                craftSummary: (lines ?? [])
                  .map(
                    (l) => `${l.craft?.name} ${l.level?.name} ×${l.quantity}`,
                  )
                  .join(" · "),
                siteName: site?.name,
                reqNumber: req.req_number,
              })}
            </h2>
            <div className="sub">
              {customer?.display_name} · {site?.name} · {site?.city}, {site?.state}
              {job && (
                <>
                  {" · job "}
                  <span className="mono">{job.job_number}</span>
                </>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <StatusBadge
              status={req.status}
              requested={(lines ?? []).reduce((n, l) => n + l.quantity, 0)}
              filled={(lines ?? []).reduce((n, l) => n + l.filled_count, 0)}
            />
            <UrgencyBadge urgency={req.urgency} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STATUS_ACTIONS.filter((s) => s.value !== req.status).map((s) => (
            <ActionForm
              key={s.value}
              action={setRequisitionStatus}
              submitLabel={s.label}
              submitClass="action-btn"
              inline
            >
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value={s.value} />
            </ActionForm>
          ))}
        </div>

        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--red)" }}>
            Delete this request permanently
          </summary>
          <div style={{ marginTop: 10 }}>
            <div className="notice-warn" style={{ marginBottom: 10 }}>
              Cancelling is usually the right move — it keeps the record and
              tells the customer why. Deleting removes the request, its craft
              lines and every placement on it. There is no undo.
            </div>
            <ActionForm
              action={deleteRequisition}
              submitLabel="Delete request"
              submitClass="action-btn"
              confirm={`Permanently delete ${req.req_number}? This cannot be undone.`}
              redirectTo="/agency"
            >
              <input type="hidden" name="id" value={id} />
            </ActionForm>
          </div>
        </details>

        {req.status !== "cancelled" && (
          <details style={{ marginTop: 14 }}>
            <summary
              style={{ cursor: "pointer", fontSize: 12.5, color: "var(--red)" }}
            >
              Cancel this request
            </summary>
            <div style={{ marginTop: 10, maxWidth: 460 }}>
              <ActionForm
                action={setRequisitionStatus}
                submitLabel="Cancel request"
                submitClass="action-btn"
                confirm="Cancel this request? The customer will see it as cancelled."
              >
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="status" value="cancelled" />
                <label className="field">
                  <span>
                    Reason <span className="req-star">*</span>
                  </span>
                  <input name="cancelled_reason" required />
                </label>
              </ActionForm>
            </div>
          </details>
        )}
      </div>

      {/* -------------------------------------------------- job details */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Job details</h2>
            <div className="sub">
              Staff can edit these at any status — the customer&apos;s own edit
              window closes once we acknowledge.
            </div>
          </div>
        </div>

        <ActionForm action={updateRequisition} submitLabel="Save details">
          <input type="hidden" name="id" value={id} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "0 14px",
            }}
          >
            <label className="field">
              <span>Title</span>
              <input name="title" defaultValue={req.title ?? ""} />
            </label>
            <label className="field">
              <span>Customer job #</span>
              <select
                name="customer_job_id"
                defaultValue={req.customer_job_id ?? ""}
              >
                <option value="">Not linked to a job</option>
                {(jobs ?? []).map((j) => (
                  <option key={j.id} value={j.id}>
                    {[j.job_number, j.end_customer].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Project</span>
              <input name="project_name" defaultValue={req.project_name ?? ""} />
            </label>
            <label className="field">
              <span>PO number</span>
              <input name="po_number" defaultValue={req.po_number ?? ""} />
            </label>
            <label className="field">
              <span>Cost code</span>
              <input name="cost_code" defaultValue={req.cost_code ?? ""} />
            </label>
            <label className="field">
              <span>Urgency</span>
              <select name="urgency" defaultValue={req.urgency}>
                <option value="standard">Standard</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </label>
            <label className="field">
              <span>Owner</span>
              <select name="owner_user_id" defaultValue={req.owner_user_id ?? ""}>
                <option value="">Unassigned</option>
                {(staff ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name ?? s.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Start date</span>
              <input name="start_date" type="date" defaultValue={req.start_date ?? ""} />
            </label>
            <label className="field">
              <span>End date</span>
              <input name="end_date" type="date" defaultValue={req.end_date ?? ""} />
            </label>
            <label className="field">
              <span>Duration (weeks)</span>
              <input
                name="duration_weeks"
                type="number"
                min="0"
                step="0.5"
                defaultValue={req.duration_weeks ?? ""}
              />
            </label>
            <label className="field">
              <span>Shift</span>
              <select name="shift" defaultValue={req.shift}>
                <option value="day">Day</option>
                <option value="night">Night</option>
                <option value="swing">Swing</option>
                <option value="rotating">Rotating</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="field">
              <span>Days / week</span>
              <input
                name="days_per_week"
                type="number"
                min="1"
                max="7"
                defaultValue={req.days_per_week}
              />
            </label>
            <label className="field">
              <span>Hours / day</span>
              <input
                name="hours_per_day"
                type="number"
                min="1"
                max="24"
                step="0.5"
                defaultValue={req.hours_per_day}
              />
            </label>
            <label className="field">
              <span>Per diem</span>
              <input
                name="per_diem_rate"
                type="number"
                min="0"
                step="0.01"
                defaultValue={req.per_diem_rate ?? ""}
              />
            </label>
          </div>

          <label className="field">
            <span>Scope of work</span>
            <textarea name="scope_of_work" rows={3} defaultValue={req.scope_of_work ?? ""} />
          </label>
          <label className="field">
            <span>Special instructions</span>
            <textarea
              name="special_instructions"
              rows={2}
              defaultValue={req.special_instructions ?? ""}
            />
          </label>
        </ActionForm>
      </div>

      {/* ------------------------------------------------------ manning */}
      {(lines ?? []).map((line) => {
        const rows = byLine.get(line.id) ?? [];
        return (
          <div className="panel" key={line.id}>
            <div className="panel-head">
              <div>
                <h2>
                  {line.craft?.name} · {line.level?.name}
                </h2>
                <div className="sub">
                  Line {line.line_number} · {line.quantity} requested
                </div>
              </div>
              <FillProgress
                requested={line.quantity}
                filled={line.filled_count}
                onboarding={line.onboarding_count}
              />
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th style={{ width: 100 }}>Visible</th>
                  <th style={{ width: 175 }}>Stage</th>
                  <th style={{ width: 145 }}>Starts</th>
                  <th style={{ width: 145 }}>Ends</th>
                  <th style={{ width: 150 }} />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className="empty-row">
                    <td colSpan={6}>Nobody placed against this line yet.</td>
                  </tr>
                ) : (
                  rows.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {p.worker?.first_name} {p.worker?.last_name}
                        </div>
                        <div className="mono" style={{ fontSize: 11.5, color: "var(--steel-dim)" }}>
                          {p.worker?.phone ?? ""}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${p.is_customer_visible ? "submitted" : "inactive"}`}
                        >
                          {p.is_customer_visible ? "Customer" : "Internal"}
                        </span>
                      </td>
                      {/* Stage and both dates save together — they are usually
                          changed in the same breath ("he's confirmed, starting
                          the 14th") and two forms would mean two round trips. */}
                      <td colSpan={4}>
                        <ActionForm
                          action={setPlacementStage}
                          submitLabel="Save"
                          submitClass="action-btn"
                          inline
                        >
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="requisition_id" value={id} />
                          <span
                            style={{
                              display: "inline-flex",
                              gap: 6,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <select
                              name="stage"
                              defaultValue={p.stage}
                              style={cellControl}
                            >
                              {STAGES.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="date"
                              name="scheduled_start_date"
                              defaultValue={p.scheduled_start_date ?? ""}
                              title="Start date for this worker"
                              style={cellControl}
                            />
                            <input
                              type="date"
                              name="scheduled_end_date"
                              defaultValue={p.scheduled_end_date ?? ""}
                              title="End date for this worker"
                              style={cellControl}
                            />
                          </span>{" "}
                        </ActionForm>
                        <ActionForm
                          action={removePlacement}
                          submitLabel="Remove"
                          submitClass="action-btn"
                          inline
                          confirm="Remove this worker from the line?"
                        >
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="requisition_id" value={id} />
                        </ActionForm>
                        {p.actual_start_date && (
                          <div style={{ fontSize: 11.5, color: "var(--green)", marginTop: 4 }}>
                            actually started {p.actual_start_date}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div
              style={{
                display: "flex",
                gap: 20,
                flexWrap: "wrap",
                marginTop: 16,
                alignItems: "flex-start",
              }}
            >
              <div style={{ minWidth: 280 }}>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>Place a worker</h3>
                <ActionForm
                  action={addPlacement}
                  submitLabel="Add to line"
                  submitClass="action-btn"
                  resetOnSuccess
                >
                  <input type="hidden" name="requisition_line_id" value={line.id} />
                  <label className="field">
                    <span>Worker</span>
                    <select name="worker_id" required defaultValue="">
                      <option value="">Choose…</option>
                      {(workers ?? []).map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.last_name}, {w.first_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="hint" style={{ marginTop: 0, marginBottom: 8 }}>
                    Starts at Identified — internal only until you move it to
                    Submitted to customer.
                  </div>
                </ActionForm>
              </div>

              <div style={{ minWidth: 280 }}>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>Line settings</h3>
                <ActionForm
                  action={updateRequisitionLine}
                  submitLabel="Save line"
                  submitClass="action-btn"
                >
                  <input type="hidden" name="id" value={line.id} />
                  <input type="hidden" name="requisition_id" value={id} />
                  <div style={{ display: "flex", gap: 10 }}>
                    <label className="field" style={{ flex: 1 }}>
                      <span>Qty</span>
                      <input name="quantity" type="number" min="1" defaultValue={line.quantity} />
                    </label>
                    <label className="field" style={{ flex: 1 }}>
                      <span>Bill rate</span>
                      <input
                        name="bill_rate"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={line.bill_rate ?? ""}
                      />
                    </label>
                    <label className="field" style={{ flex: 1 }}>
                      <span>Target pay</span>
                      <input
                        name="target_pay_rate"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={line.target_pay_rate ?? ""}
                      />
                    </label>
                  </div>
                </ActionForm>
              </div>
            </div>
          </div>
        );
      })}

      {/* ----------------------------------------------------- add line */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Add a craft line</h2>
            <div className="sub">
              Each craft and level pair is sourced and filled separately.
            </div>
          </div>
        </div>

        <ActionForm action={addRequisitionLine} submitLabel="Add line" resetOnSuccess>
          <input type="hidden" name="requisition_id" value={id} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "0 14px",
            }}
          >
            <label className="field">
              <span>
                Craft <span className="req-star">*</span>
              </span>
              <select name="craft_id" required defaultValue="">
                <option value="">Choose…</option>
                {(crafts ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>
                Level <span className="req-star">*</span>
              </span>
              <select name="level_id" required defaultValue="">
                <option value="">Choose…</option>
                {(levels ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Quantity</span>
              <input name="quantity" type="number" min="1" defaultValue={1} />
            </label>
            <label className="field">
              <span>Bill rate</span>
              <input name="bill_rate" type="number" min="0" step="0.01" />
            </label>
            <label className="field">
              <span>Target pay</span>
              <input name="target_pay_rate" type="number" min="0" step="0.01" />
            </label>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
