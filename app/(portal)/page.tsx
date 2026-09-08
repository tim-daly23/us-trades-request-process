import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPortalScope } from "@/lib/preview";
import { getProfile } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { FillProgress } from "@/components/fill-progress";
import { formatDate, relativeDays } from "@/lib/format";

type Req = {
  id: string;
  req_number: string;
  title: string | null;
  status: string;
  urgency: string;
  start_date: string;
  site: { name: string } | null;
};

type Fill = {
  requisition_id: string;
  total_requested: number;
  total_filled: number;
  total_onboarding: number;
  total_open: number;
};

type Candidate = {
  placement_id: string;
  requisition_id: string;
  stage: string;
  first_name: string;
  last_initial: string;
  craft_name: string;
  level_name: string;
  scheduled_start_date: string | null;
};

const OPEN = new Set([
  "submitted",
  "acknowledged",
  "sourcing",
  "partially_filled",
]);
const CLOSED = new Set(["completed", "cancelled"]);
const AWAITING_YOU = new Set(["submitted_to_customer", "customer_reviewing"]);
const ON_SITE_STAGES = new Set(["started"]);
const ONBOARDING_STAGES = new Set(["customer_approved", "onboarding", "confirmed"]);

export default async function CustomerDashboard() {
  const supabase = await createClient();
  const profile = await getProfile();
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

  const [{ data: reqs }, { data: fills }, { data: candidates }, { count: siteCount }] =
    await Promise.all([
      only(
        supabase
          .from("requisitions")
          .select(
            "id, req_number, title, status, urgency, start_date, site:sites(name)",
          ),
      )
        .order("start_date", { ascending: true })
        .returns<Req[]>(),
      only(supabase.from("requisition_fill_summary").select("*")).returns<Fill[]>(),
      only(
        supabase
          .from("customer_candidate_view")
          .select(
            "placement_id, requisition_id, stage, first_name, last_initial, craft_name, level_name, scheduled_start_date",
          ),
      ).returns<Candidate[]>(),
      only(
        supabase.from("sites").select("id", { count: "exact", head: true }),
      ).eq("status", "active"),
    ]);

  const rows = reqs ?? [];
  const fillFor = new Map((fills ?? []).map((f) => [f.requisition_id, f]));
  const live = rows.filter((r) => !CLOSED.has(r.status));
  const liveIds = new Set(live.map((r) => r.id));

  const totals = live.reduce(
    (acc, r) => {
      const f = fillFor.get(r.id);
      return {
        requested: acc.requested + (f?.total_requested ?? 0),
        filled: acc.filled + (f?.total_filled ?? 0),
        onboarding: acc.onboarding + (f?.total_onboarding ?? 0),
        open: acc.open + (f?.total_open ?? 0),
      };
    },
    { requested: 0, filled: 0, onboarding: 0, open: 0 },
  );

  const visible = (candidates ?? []).filter((c) => liveIds.has(c.requisition_id));
  const awaitingReview = visible.filter((c) => AWAITING_YOU.has(c.stage));
  const onSite = visible.filter((c) => ON_SITE_STAGES.has(c.stage));
  const inOnboarding = visible.filter((c) => ONBOARDING_STAGES.has(c.stage));

  // Grouped by where the work actually is, not by status: a request whose
  // start date has passed is underway whatever anyone remembered to click.
  const today = new Date().toISOString().slice(0, 10);

  const upcoming = live
    .filter((r) => r.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const current = live
    .filter((r) => r.start_date <= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const completed = rows
    .filter((r) => CLOSED.has(r.status))
    .sort((a, b) => b.start_date.localeCompare(a.start_date));

  return (
    <>
      <div className="panel-head" style={{ marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 24 }}>
            {greeting()}
            {profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h2>
          <div className="sub">
            Where your manpower stands today.
          </div>
        </div>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/requests" className="action-btn">
            All requests
          </Link>
          <Link href="/requisitions/new" className="btn-primary">
            New request
          </Link>
        </span>
      </div>

      <div className="stat-row">
        <Stat tone="pipeline" value={live.filter((r) => OPEN.has(r.status)).length} label="Open requests" />
        <Stat tone="progress" value={totals.open} label="Spots still open" />
        <Stat tone="approved" value={totals.filled} label="Filled and cleared" />
        <Stat tone="working" value={onSite.length} label="On site now" />
      </div>

      <div className="stat-row">
        <Stat tone="progress" value={awaitingReview.length} label="Awaiting your review" />
        <Stat tone="pipeline" value={inOnboarding.length} label="In onboarding" />
        <Stat tone="pipeline" value={totals.requested} label="Total requested" />
        <Stat tone="pipeline" value={siteCount ?? 0} label="Active sites" />
      </div>

      {awaitingReview.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Awaiting your review</h2>
              <div className="sub">
                US Trades has put these people forward. Nothing moves until you
                decide.
              </div>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th style={{ width: 220 }}>Craft &amp; level</th>
                <th style={{ width: 140 }}>Proposed start</th>
              </tr>
            </thead>
            <tbody>
              {awaitingReview.map((c) => (
                <tr key={c.placement_id}>
                  <td style={{ fontWeight: 500 }}>
                    {c.first_name} {c.last_initial}
                  </td>
                  <td style={{ color: "var(--steel)" }}>
                    {c.craft_name} · {c.level_name}
                  </td>
                  <td className="mono" style={{ fontSize: 12.5 }}>
                    {formatDate(c.scheduled_start_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RequestGroup
        title="Upcoming starts"
        empty="Nothing scheduled yet."
        rows={upcoming}
        fillFor={fillFor}
      />

      <RequestGroup
        title="Current projects"
        empty="Nothing underway."
        rows={current}
        fillFor={fillFor}
      />

      <RequestGroup
        title="Completed projects"
        empty="Nothing completed yet."
        rows={completed}
        fillFor={fillFor}
        muted
      />
    </>
  );
}

/**
 * One grouping of requests.
 *
 * A row is flagged amber when it starts within the week and is not fully
 * crewed — the thing worth acting on, kept in place rather than split into its
 * own panel where it would repeat the row.
 */
function RequestGroup({
  title,
  empty,
  rows,
  fillFor,
  muted,
}: {
  title: string;
  empty: string;
  rows: Req[];
  fillFor: Map<string, Fill>;
  muted?: boolean;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
        </div>
        <span className="mono" style={{ fontSize: 13, color: "var(--steel)" }}>
          {rows.length}
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 175 }}>Request</th>
            <th>Site</th>
            <th style={{ width: 120 }}>Start</th>
            <th style={{ width: 160 }}>Quantity filled</th>
            <th style={{ width: 130 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="empty-row">
              <td colSpan={5}>{empty}</td>
            </tr>
          ) : (
            rows.map((r) => {
              const f = fillFor.get(r.id);
              const when = relativeDays(r.start_date);
              const short =
                !muted &&
                f &&
                f.total_open > 0 &&
                when !== null &&
                (when === "today" ||
                  when === "tomorrow" ||
                  /^in [0-6] days$/.test(when));
              return (
                <tr
                  key={r.id}
                  style={short ? { background: "var(--pending-dim)" } : undefined}
                >
                  <td>
                    <ReqLink id={r.id} number={r.req_number} />
                  </td>
                  <td style={muted ? { color: "var(--steel)" } : undefined}>
                    {r.site?.name ?? "—"}
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 12.5 }}>
                      {formatDate(r.start_date).replace(/,.*$/, "")}
                    </span>
                    {when && (
                      <div style={{ fontSize: 11, color: "var(--steel)" }}>
                        {when}
                      </div>
                    )}
                  </td>
                  <td>
                    {f && f.total_requested > 0 ? (
                      <FillProgress
                        requested={f.total_requested}
                        filled={f.total_filled}
                        onboarding={f.total_onboarding}
                      />
                    ) : (
                      <span style={{ color: "var(--steel-dim)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge
                      status={r.status}
                      requested={f?.total_requested}
                      filled={f?.total_filled}
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "pipeline" | "progress" | "approved" | "working";
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-num">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function ReqLink({ id, number }: { id: string; number: string }) {
  return (
    <Link
      href={`/requisitions/${id}`}
      className="mono"
      style={{
        fontSize: 12.5,
        fontWeight: 500,
        color: "var(--ink)",
        textDecoration: "none",
        borderBottom: "1px dotted var(--steel)",
        whiteSpace: "nowrap",
      }}
    >
      {number}
    </Link>
  );
}
