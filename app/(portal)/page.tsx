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

  const startingSoon = live
    .filter((r) => {
      const d = relativeDays(r.start_date);
      return d !== null && !d.includes("ago");
    })
    .slice(0, 5);

  const needsAttention = live.filter((r) => {
    const f = fillFor.get(r.id);
    const days = relativeDays(r.start_date);
    return (
      f &&
      f.total_open > 0 &&
      days !== null &&
      (days === "today" || days === "tomorrow" || /^in [0-9] days$/.test(days))
    );
  });

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
        <Link href="/requisitions/new" className="btn-primary">
          New request
        </Link>
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

      {needsAttention.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Starting soon with spots open</h2>
              <div className="sub">
                These start within the week and are not fully crewed.
              </div>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 175 }}>Request</th>
                <th>Site</th>
                <th style={{ width: 120 }}>Start</th>
                <th style={{ width: 160 }}>Quantity filled</th>
              </tr>
            </thead>
            <tbody>
              {needsAttention.map((r) => {
                const f = fillFor.get(r.id);
                return (
                  <tr key={r.id} style={{ background: "var(--pending-dim)" }}>
                    <td>
                      <ReqLink id={r.id} number={r.req_number} />
                    </td>
                    <td>{r.site?.name ?? "—"}</td>
                    <td>
                      <span className="mono" style={{ fontSize: 12.5 }}>
                        {formatDate(r.start_date).replace(/,.*$/, "")}
                      </span>
                      <div style={{ fontSize: 11, color: "var(--steel)" }}>
                        {relativeDays(r.start_date)}
                      </div>
                    </td>
                    <td>
                      {f && (
                        <FillProgress
                          requested={f.total_requested}
                          filled={f.total_filled}
                          onboarding={f.total_onboarding}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Next to start</h2>
            <div className="sub">Your upcoming work, soonest first.</div>
          </div>
          <Link href="/requests" className="action-btn">
            All requests
          </Link>
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
            {startingSoon.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={5}>
                  Nothing upcoming. Raise a request and it will show here.
                </td>
              </tr>
            ) : (
              startingSoon.map((r) => {
                const f = fillFor.get(r.id);
                return (
                  <tr key={r.id}>
                    <td>
                      <ReqLink id={r.id} number={r.req_number} />
                    </td>
                    <td>{r.site?.name ?? "—"}</td>
                    <td>
                      <span className="mono" style={{ fontSize: 12.5 }}>
                        {formatDate(r.start_date).replace(/,.*$/, "")}
                      </span>
                      <div style={{ fontSize: 11, color: "var(--steel)" }}>
                        {relativeDays(r.start_date)}
                      </div>
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
                      <StatusBadge status={r.status} />
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
