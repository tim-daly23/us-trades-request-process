"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRequisition } from "@/app/(portal)/requisitions/new/actions";
import { formatSchedule } from "@/lib/format";
import type {
  CraftOption,
  CustomerOption,
  JobOption,
  CredentialOption,
  DraftLine,
  LevelOption,
  SiteOption,
} from "@/lib/requisition-types";

const SHIFTS = ["day", "night", "swing", "rotating", "other"] as const;
const URGENCIES = [
  { value: "standard", label: "Standard" },
  { value: "urgent", label: "Urgent" },
  { value: "emergency", label: "Emergency" },
] as const;

let rowSeq = 0;
const newRow = (): DraftLine => ({
  key: `row-${rowSeq++}`,
  craftId: "",
  levelId: "",
  quantity: 1,
});

export function RequestForm({
  customers,
  jobs,
  sites,
  crafts,
  levels,
  credentials,
}: {
  /** Empty for customer users — their tenant is fixed. */
  customers: CustomerOption[];
  jobs: JobOption[];
  sites: SiteOption[];
  crafts: CraftOption[];
  levels: LevelOption[];
  credentials: CredentialOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isAgency = customers.length > 0;
  const [customerId, setCustomerId] = useState("");
  const [jobId, setJobId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [title, setTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [urgency, setUrgency] =
    useState<(typeof URGENCIES)[number]["value"]>("standard");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [durationWeeks, setDurationWeeks] = useState("");
  const [shift, setShift] = useState("day");
  const [hoursPerDay, setHoursPerDay] = useState("10");
  const [daysPerWeek, setDaysPerWeek] = useState("6");
  const [perDiemRate, setPerDiemRate] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([newRow()]);

  const [credentialIds, setCredentialIds] = useState<string[]>(() =>
    credentials.filter((c) => c.mandatory || c.defaultChecked).map((c) => c.id),
  );

  const visibleSites = isAgency
    ? sites.filter((s) => s.customer_id === customerId)
    : sites;
  const visibleJobs = isAgency
    ? jobs.filter((j) => j.customer_id === customerId)
    : jobs;

  /**
   * Choosing a job carries across what the job already establishes: its per
   * diem, and TWIC if that job needs it. Both are still editable — the job is
   * a starting point, not a constraint.
   */
  function onJobChange(id: string) {
    setJobId(id);
    const job = jobs.find((j) => j.id === id);
    if (!job) return;

    if (job.per_diem_rate != null) {
      setPerDiemRate(String(Number(job.per_diem_rate)));
    }
    if (job.twic_required) {
      const twic = credentials.find((c) => c.code === "TWIC");
      if (twic) {
        setCredentialIds((prev) =>
          prev.includes(twic.id) ? prev : [...prev, twic.id],
        );
      }
    }
  }

  /**
   * Choosing a site replaces the schedule defaults and adds that site's
   * standing credential requirements. Anything the user has already ticked is
   * kept — the site adds requirements, it never removes them.
   */
  function onSiteChange(id: string) {
    setSiteId(id);
    const s = sites.find((x) => x.id === id);
    if (!s) return;

    if (s.default_shift) setShift(s.default_shift);
    if (s.default_hours_per_day != null)
      setHoursPerDay(String(Number(s.default_hours_per_day)));
    if (s.default_days_per_week != null)
      setDaysPerWeek(String(s.default_days_per_week));
    if (s.default_per_diem_rate != null)
      setPerDiemRate(String(Number(s.default_per_diem_rate)));

    if (s.default_credential_ids?.length) {
      setCredentialIds((prev) =>
        Array.from(new Set([...prev, ...s.default_credential_ids!])),
      );
    }
  }


  const totalWorkers = lines.reduce(
    (n, l) => n + (l.craftId && l.levelId ? Number(l.quantity) || 0 : 0),
    0,
  );

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }

  function submit(shouldSubmit: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await createRequisition({
        customerId,
        jobId,
        siteId,
        title,
        projectName,
        urgency,
        startDate,
        endDate,
        durationWeeks,
        shift,
        hoursPerDay,
        daysPerWeek,
        perDiemRate,
        scopeOfWork,
        specialInstructions,
        lines: lines
          .filter((l) => l.craftId && l.levelId && l.quantity > 0)
          .map((l) => ({
            craftId: l.craftId,
            levelId: l.levelId,
            quantity: Number(l.quantity),
          })),
        credentialIds,
        submit: shouldSubmit,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/requisitions/${result.id}`);
    });
  }

  return (
    <div>
      {/* --- where and when ------------------------------------------- */}
      <Card title="Site and schedule">
        <Grid>
          {isAgency && (
            <Field label="Customer" required>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setSiteId("");
                }}
              >
                <option value="">Choose a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Site" required className="">
            <select
              value={siteId}
              onChange={(e) => onSiteChange(e.target.value)}
              className={inputClass}
              disabled={isAgency && !customerId}
            >
              <option value="">
                {isAgency && !customerId ? "Choose a customer first" : "Choose a site…"}
              </option>
              {visibleSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.city}, {s.state}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Job #">
            <select
              value={jobId}
              onChange={(e) => onJobChange(e.target.value)}
              className={inputClass}
              disabled={isAgency && !customerId}
            >
              <option value="">
                {visibleJobs.length === 0 ? "No jobs logged" : "Not linked to a job"}
              </option>
              {visibleJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.job_number}
                  {j.end_customer ? ` · ${j.end_customer}` : ""}
                  {j.description ? ` · ${j.description}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Urgency">
            <select
              value={urgency}
              onChange={(e) =>
                setUrgency(e.target.value as typeof urgency)
              }
              className={inputClass}
            >
              {URGENCIES.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Start date" required>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Duration (weeks)">
            <input
              type="number"
              min="0"
              step="0.5"
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Shift">
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className={inputClass}
            >
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Days per week">
            <input
              type="number"
              min="1"
              max="7"
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Hours per day">
            <input
              type="number"
              min="1"
              max="24"
              step="0.5"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Per diem (daily)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={perDiemRate}
              onChange={(e) => setPerDiemRate(e.target.value)}
              className={inputClass}
            />
          </Field>
        </Grid>

        <p className="mt-4 text-sm text-muted">
          Schedule reads as{" "}
          <span className="font-medium text-foreground">
            {formatSchedule(daysPerWeek, hoursPerDay)}
          </span>
        </p>

      </Card>

      {/* --- who ------------------------------------------------------- */}
      <Card
        title="Craft needed"
        aside={
          totalWorkers > 0
            ? `${totalWorkers} worker${totalWorkers === 1 ? "" : "s"}`
            : undefined
        }
      >
        <div className="space-y-3">
          {lines.map((line, i) => (
            <div
              key={line.key}
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_6rem_auto]"
            >
              <Field label={i === 0 ? "Craft" : undefined}>
                <select
                  value={line.craftId}
                  onChange={(e) =>
                    updateLine(line.key, { craftId: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">Choose craft…</option>
                  {crafts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={i === 0 ? "Level" : undefined}>
                <select
                  value={line.levelId}
                  onChange={(e) =>
                    updateLine(line.key, { levelId: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">Choose level…</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={i === 0 ? "Qty" : undefined}>
                <input
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(line.key, { quantity: Number(e.target.value) })
                  }
                  className={`${inputClass} tnum`}
                />
              </Field>

              <button
                type="button"
                onClick={() =>
                  setLines((prev) =>
                    prev.length === 1
                      ? [newRow()]
                      : prev.filter((l) => l.key !== line.key),
                  )
                }
                className="h-[38px] rounded-md border border-line px-3 text-sm text-muted transition hover:border-danger hover:text-danger"
                aria-label={`Remove line ${i + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, newRow()])}
          className="mt-4 rounded-md border border-dashed border-line px-4 py-2 text-sm font-medium text-muted transition hover:border-brand hover:text-brand"
        >
          + Add another craft or level
        </button>
      </Card>

      {/* --- what they must hold --------------------------------------- */}
      {credentials.length > 0 && (
        <Card title="Credentials required">
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {credentials.map((c) => {
              const checked = credentialIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-start gap-2.5 text-sm ${
                    c.mandatory ? "opacity-70" : "cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={c.mandatory}
                    onChange={(e) =>
                      setCredentialIds((prev) =>
                        e.target.checked
                          ? [...prev, c.id]
                          : prev.filter((id) => id !== c.id),
                      )
                    }
                    className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                  />
                  <span>
                    {c.label}
                    {c.mandatory && (
                      <span className="ml-1 text-xs text-muted">(always)</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>
      )}

      {/* --- context --------------------------------------------------- */}
      <Card title="Job name and scope">
        <Grid>
          <Field label="Job name" className="">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fall Turnaround — Unit 7"
              className={inputClass}
            />
          </Field>
          <Field label="Project / unit">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="TA-2026-U7"
              className={inputClass}
            />
          </Field>
        </Grid>

        <div className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
          Job name is optional — leave it blank and the request is listed by
          the craft you asked for and the site.
        </div>

        <div className="mt-4 space-y-4">
          <Field label="Scope of work">
            <textarea
              rows={3}
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              placeholder="What the crew will be doing."
              className={inputClass}
            />
          </Field>
          <Field label="Special instructions">
            <textarea
              rows={2}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Access, PPE, tools, anything unusual."
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      {/* --- actions --------------------------------------------------- */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderTop: "3px solid var(--ink)",
          padding: "14px 18px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 18,
        }}
      >
        <div style={{ fontSize: 12.5, color: "var(--steel)" }}>
          {error ? (
            <span style={{ color: "var(--brand-red)", fontWeight: 500 }}>
              {error}
            </span>
          ) : totalWorkers > 0 ? (
            <>
              <span className="mono">{totalWorkers}</span> worker
              {totalWorkers === 1 ? "" : "s"} ·{" "}
              {formatSchedule(daysPerWeek, hoursPerDay)}
            </>
          ) : (
            "Add at least one craft line."
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="action-btn"
            style={{ padding: "9px 16px", fontSize: 14 }}
            disabled={pending}
            onClick={() => submit(false)}
          >
            Save draft
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={() => submit(true)}
          >
            {pending ? "Saving…" : "Submit request"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Inputs inherit their look from the .field wrapper, matching the dashboard.
const inputClass = "";

function Card({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
        </div>
        {aside && (
          <span className="mono" style={{ fontSize: 13 }}>
            {aside}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "0 14px",
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`field ${className}`}>
      {label && (
        <span>
          {label}
          {required && <span className="req-star"> *</span>}
        </span>
      )}
      {children}
    </label>
  );
}
