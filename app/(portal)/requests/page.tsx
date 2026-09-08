import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPortalScope } from "@/lib/preview";
import { StatusBadge, UrgencyBadge } from "@/components/status-badge";
import { FillProgress } from "@/components/fill-progress";
import { formatDate } from "@/lib/format";

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
  job: { job_number: string } | null;
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

const CLOSED = new Set(["completed", "cancelled"]);

export default async function RequisitionsPage() {
  const supabase = await createClient();
  const scope = await getPortalScope();

  // Agency staff can read every tenant, so the portal screens filter to the
  // previewed customer. For a customer user this is their own id and the
  // filter is redundant with RLS — harmless, and keeps one code path.
  const only = <T,>(q: T): T =>
    scope.customerId
      ? ((q as { eq: (c: string, v: string) => T }).eq(
          "customer_id",
          scope.customerId,
        ) as T)
      : q;

  // RLS scopes all three to the caller's tenant; no customer_id filter here.
  const [{ data: reqs, error }, { data: fills }, { data: lines }] =
    await Promise.all([
      only(
        supabase
          .from("requisitions")
          .select(
            `id, req_number, title, status, urgency, start_date, duration_weeks,
             is_ongoing, site:sites(name, city, state),
             job:customer_jobs(job_number)`,
          ),
      )
        .order("start_date", { ascending: true })
        .returns<Requisition[]>(),
      only(supabase.from("requisition_fill_summary").select("*")).returns<FillRow[]>(),
      only(
        supabase
          .from("requisition_lines_visible")
          .select("requisition_id, quantity, craft_name, level_name"),
      )
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

  const live = rows.filter((r) => !CLOSED.has(r.status) && r.status !== "draft");
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
          <div className="stat-num">{live.length}</div>
          <div className="stat-label">Open requests</div>
        </div>
        <div className="stat-card progress">
          <div className="stat-num">{totals.requested}</div>
          <div className="stat-label">Quantity requested</div>
        </div>
        <div className="stat-card approved">
          <div className="stat-num">{totals.filled}</div>
          <div className="stat-label">Quantity filled</div>
        </div>
        <div className="stat-card working">
          <div className="stat-num">
            {
              live.filter((r) => {
                const f = fillFor.get(r.id);
                return f && f.total_requested > 0 && f.total_filled >= f.total_requested;
              }).length
            }
          </div>
          <div className="stat-label">Fully filled</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>All requests</h2>
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
              <th style={{ width: 175 }}>Request</th>
              <th style={{ width: 90 }}>Job #</th>
              <th style={{ width: 210 }}>Site</th>
              <th style={{ width: 90 }}>Start</th>
              <th style={{ width: 80 }}>Duration</th>
              <th>Craft &amp; level</th>
              <th style={{ width: 150 }}>Quantity filled</th>
              <th style={{ width: 130 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={8}>
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
                      {/* Identifier only. The craft, site and dates each have
                          their own column — repeating them here just crowds
                          the row. */}
                      <Link
                        href={`/requisitions/${r.id}`}
                        className="mono"
                        style={{
                          color: isDraft ? "var(--steel-dim)" : "var(--ink)",
                          fontSize: 12.5,
                          fontWeight: 500,
                          textDecoration: "none",
                          borderBottom: "1px dotted var(--steel)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isDraft ? "Draft" : r.req_number}
                      </Link>
                    </td>
                    <td className="mono" style={{ fontSize: 12.5 }}>
                      {r.job?.job_number ?? (
                        <span style={{ color: "var(--steel-dim)" }}>—</span>
                      )}
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
                              // Fixed first column rather than a right-aligned
                              // box: the digit then starts flush with the
                              // column header, and craft names still line up
                              // whether the quantity is 2 or 12.
                              display: "grid",
                              gridTemplateColumns: "1.5rem 1fr",
                              color: "var(--steel)",
                              lineHeight: 1.5,
                            }}
                          >
                            <span className="mono">{l.quantity}</span>
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
