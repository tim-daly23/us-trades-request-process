import Link from "next/link";
import { requireAgency } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, UrgencyBadge } from "@/components/status-badge";
import { FillProgress } from "@/components/fill-progress";
import { formatDate, relativeDays, requisitionLabel } from "@/lib/format";

type Row = {
  id: string;
  req_number: string;
  title: string | null;
  status: string;
  urgency: string;
  start_date: string;
  customer: { display_name: string; slug: string } | null;
  site: { name: string } | null;
  owner: { full_name: string | null; email: string } | null;
};

type Fill = {
  requisition_id: string;
  total_requested: number;
  total_filled: number;
  total_onboarding: number;
};

const NEEDS_ACTION = new Set(["submitted", "pending_approval"]);
const WORKING = new Set(["acknowledged", "sourcing", "partially_filled"]);
const CLOSED = new Set(["completed", "cancelled"]);

export default async function AgencyQueue() {
  await requireAgency();
  const supabase = await createClient();

  // No tenant filter: an agency JWT sees every customer's rows by policy.
  const [{ data: reqs, error }, { data: fills }] = await Promise.all([
    supabase
      .from("requisitions")
      .select(
        `id, req_number, title, status, urgency, start_date,
         customer:customers(display_name, slug),
         site:sites(name),
         owner:app_users!requisitions_owner_user_id_fkey(full_name, email)`,
      )
      .is("deleted_at", null)
      .order("start_date", { ascending: true })
      .returns<Row[]>(),
    supabase.from("requisition_fill_summary").select("*").returns<Fill[]>(),
  ]);

  if (error) {
    return (
      <div className="gate">
        <strong>Could not load the queue.</strong>
        <div style={{ marginTop: 4, fontSize: 12.5 }}>{error.message}</div>
      </div>
    );
  }

  const rows = reqs ?? [];
  const fillFor = new Map((fills ?? []).map((f) => [f.requisition_id, f]));
  const live = rows.filter((r) => !CLOSED.has(r.status));

  const seats = live.reduce(
    (acc, r) => {
      const f = fillFor.get(r.id);
      return {
        requested: acc.requested + (f?.total_requested ?? 0),
        filled: acc.filled + (f?.total_filled ?? 0),
      };
    },
    { requested: 0, filled: 0 },
  );

  return (
    <>
      <div className="stat-row">
        <div className="stat-card progress">
          <div className="stat-num">
            {rows.filter((r) => NEEDS_ACTION.has(r.status)).length}
          </div>
          <div className="stat-label">Awaiting acknowledgement</div>
        </div>
        <div className="stat-card pipeline">
          <div className="stat-num">
            {rows.filter((r) => WORKING.has(r.status)).length}
          </div>
          <div className="stat-label">Sourcing</div>
        </div>
        <div className="stat-card approved">
          <div className="stat-num">{seats.filled}</div>
          <div className="stat-label">Seats filled</div>
        </div>
        <div className="stat-card working">
          <div className="stat-num">{seats.requested - seats.filled}</div>
          <div className="stat-label">Seats still open</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Requisition queue</h2>
            <div className="sub">
              Every customer&apos;s requests. Unassigned and unacknowledged ones
              are flagged.
            </div>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 140 }}>Request</th>
              <th style={{ width: 150 }}>Customer</th>
              <th style={{ width: 180 }}>Site</th>
              <th style={{ width: 110 }}>Start</th>
              <th style={{ width: 150 }}>Seats filled</th>
              <th style={{ width: 130 }}>Status</th>
              <th style={{ width: 120 }}>Owner</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={7}>Nothing in the queue.</td>
              </tr>
            ) : (
              rows.map((r) => {
                const fill = fillFor.get(r.id);
                const when = relativeDays(r.start_date);
                const needsAck = NEEDS_ACTION.has(r.status);
                return (
                  <tr
                    key={r.id}
                    style={
                      needsAck ? { background: "var(--pending-dim)" } : undefined
                    }
                  >
                    <td>
                      <Link
                        href={`/agency/requisitions/${r.id}`}
                        className="mono"
                        style={{
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: "var(--ink)",
                          textDecoration: "none",
                          borderBottom: "1px dotted var(--steel)",
                        }}
                      >
                        {r.req_number}
                      </Link>
                      <div style={{ fontSize: 11.5, color: "var(--steel-dim)" }}>
                        {requisitionLabel({
                          title: r.title,
                          siteName: r.site?.name,
                          reqNumber: r.req_number,
                        })}
                      </div>
                    </td>
                    <td>{r.customer?.display_name ?? "—"}</td>
                    <td style={{ color: "var(--steel)" }}>
                      {r.site?.name ?? "—"}
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: 12.5 }}>
                        {formatDate(r.start_date).replace(/,.*$/, "")}
                      </span>
                      {when && (
                        <div style={{ fontSize: 11, color: "var(--steel-dim)" }}>
                          {when}
                        </div>
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
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <StatusBadge status={r.status} />
                        <UrgencyBadge urgency={r.urgency} />
                      </div>
                    </td>
                    <td
                      style={{
                        color: r.owner ? "var(--steel)" : "var(--red)",
                        fontSize: 12.5,
                      }}
                    >
                      {r.owner?.full_name ?? r.owner?.email ?? "Unassigned"}
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
