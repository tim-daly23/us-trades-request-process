import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, UrgencyBadge } from "@/components/status-badge";
import { FillProgress } from "@/components/fill-progress";
import { formatDate, requisitionLabel } from "@/lib/format";

type SiteRef = { name: string; city: string; state: string } | null;

type Requisition = {
  id: string;
  req_number: string;
  title: string | null;
  status: string;
  urgency: string;
  start_date: string;
  duration_weeks: number | string | null;
  is_ongoing: boolean;
  site: SiteRef;
};

type FillRow = {
  requisition_id: string;
  total_requested: number;
  total_filled: number;
  total_onboarding: number;
};

type LineRow = {
  requisition_id: string;
  quantity: number;
  craft_name: string;
  level_name: string;
};

const OPEN = new Set([
  "submitted",
  "acknowledged",
  "sourcing",
  "partially_filled",
]);
const ON_SITE = new Set(["filled", "active"]);
const CLOSED = new Set(["completed", "cancelled"]);

function summarizeLines(lines: LineRow[]): string {
  return lines
    .map((l) => `${l.craft_name} ${l.level_name} ×${l.quantity}`)
    .join(" · ");
}

export default async function RequisitionsPage() {
  const supabase = await createClient();

  // RLS scopes all three to the caller's tenant; no customer_id filter here.
  const [{ data: reqs, error }, { data: fills }, { data: lines }] =
    await Promise.all([
      supabase
        .from("requisitions")
        .select(
          `id, req_number, title, status, urgency, start_date, duration_weeks,
           is_ongoing, site:sites(name, city, state)`,
        )
        .order("start_date", { ascending: true })
        .returns<Requisition[]>(),
      supabase.from("requisition_fill_summary").select("*").returns<FillRow[]>(),
      supabase
        .from("requisition_lines_visible")
        .select("requisition_id, quantity, craft_name, level_name")
        .order("line_number")
        .returns<LineRow[]>(),
    ]);

  if (error) {
    return (
      <div className="gate">
        <strong>Could not load requisitions.</strong>
        <div style={{ marginTop: 4, fontSize: 12.5 }}>{error.message}</div>
      </div>
    );
  }

  const rows = reqs ?? [];
  const fillFor = new Map((fills ?? []).map((f) => [f.requisition_id, f]));
  const linesFor = new Map<string, LineRow[]>();
  for (const l of lines ?? []) {
    linesFor.set(l.requisition_id, [
      ...(linesFor.get(l.requisition_id) ?? []),
      l,
    ]);
  }

  const live = rows.filter((r) => !CLOSED.has(r.status));
  const totals = live.reduce(
    (acc, r) => {
      const f = fillFor.get(r.id);
      return {
        requested: acc.requested + (f?.total_requested ?? 0),
        filled: acc.filled + (f?.total_filled ?? 0),
        onboarding: acc.onboarding + (f?.total_onboarding ?? 0),
      };
    },
    { requested: 0, filled: 0, onboarding: 0 },
  );

  return (
    <>
      <div className="stat-row">
        <div className="stat-card pipeline">
          <div className="stat-num">
            {rows.filter((r) => OPEN.has(r.status)).length}
          </div>
          <div className="stat-label">Open requests</div>
        </div>
        <div className="stat-card progress">
          <div className="stat-num">{totals.requested}</div>
          <div className="stat-label">Seats requested</div>
        </div>
        <div className="stat-card approved">
          <div className="stat-num">{totals.filled}</div>
          <div className="stat-label">Seats filled</div>
        </div>
        <div className="stat-card working">
          <div className="stat-num">
            {rows.filter((r) => ON_SITE.has(r.status)).length}
          </div>
          <div className="stat-label">On site</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Manpower requests</h2>
            <div className="sub">
              Every request you have raised, and how far each one is filled.
            </div>
          </div>
          <Link href="/requisitions/new" className="btn-primary">
            New request
          </Link>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 140 }}>Request</th>
              <th style={{ width: 210 }}>Site</th>
              <th style={{ width: 90 }}>Start</th>
              <th style={{ width: 80 }}>Duration</th>
              <th>Craft &amp; level</th>
              <th style={{ width: 150 }}>Seats filled</th>
              <th style={{ width: 130 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={7}>
                  No requests yet — raise one and it will appear here.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const fill = fillFor.get(r.id);
                const isDraft = r.status === "draft";
                return (
                  <tr key={r.id}>
                    <td>
                      <Link
                        href={`/requisitions/${r.id}`}
                        className="mono"
                        style={{
                          color: isDraft ? "var(--steel-dim)" : "var(--ink)",
                          fontSize: 12.5,
                          fontWeight: 500,
                          textDecoration: "none",
                          borderBottom: "1px dotted var(--steel)",
                        }}
                      >
                        {isDraft ? "Draft" : r.req_number}
                      </Link>
                      <div style={{ fontSize: 11.5, color: "var(--steel-dim)" }}>
                        {requisitionLabel({
                          title: r.title,
                          craftSummary: summarizeLines(linesFor.get(r.id) ?? []),
                          siteName: r.site?.name,
                          reqNumber: r.req_number,
                        })}
                      </div>
                    </td>
                    <td>{r.site?.name ?? "—"}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>
                      {formatDate(r.start_date).replace(/,.*$/, "")}
                    </td>
                    <td
                      className="mono"
                      style={{ fontSize: 12.5, color: "var(--steel)" }}
                    >
                      {r.is_ongoing
                        ? "Ongoing"
                        : r.duration_weeks
                          ? `${Number(r.duration_weeks)} wks`
                          : "—"}
                    </td>
                    <td>
                      {(linesFor.get(r.id) ?? []).length === 0 ? (
                        <span style={{ color: "var(--steel-dim)" }}>—</span>
                      ) : (
                        (linesFor.get(r.id) ?? []).map((l, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              gap: 8,
                              color: "var(--steel)",
                              lineHeight: 1.5,
                            }}
                          >
                            <span
                              className="mono"
                              style={{ minWidth: 22, textAlign: "right" }}
                            >
                              {l.quantity}
                            </span>
                            <span>
                              {l.craft_name}{" "}
                              <span style={{ color: "var(--steel-dim)" }}>
                                {l.level_name}
                              </span>
                            </span>
                          </div>
                        ))
                      )}
                    </td>
                    <td>
                      {fill && fill.total_requested > 0 ? (
                        <FillProgress
                          requested={fill.total_requested}
                          filled={fill.total_filled}
                          onboarding={fill.total_onboarding}
                        />
                      ) : (
                        <span style={{ color: "var(--steel-dim)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <div
                        style={{ display: "flex", gap: 5, flexWrap: "wrap" }}
                      >
                        <StatusBadge status={r.status} />
                        <UrgencyBadge urgency={r.urgency} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
