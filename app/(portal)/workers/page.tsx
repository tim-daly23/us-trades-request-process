import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPortalScope } from "@/lib/preview";
import { formatDate } from "@/lib/format";
import { OnSiteControls } from "@/components/onsite-controls";

/**
 * The customer's workforce.
 *
 * Reads customer_candidate_view, never the workers table. That view is the only
 * path by which worker data reaches a customer: it filters to placements
 * actually submitted to them, and returns a first name and last initial unless
 * the account is configured for full contact details.
 */
type Row = {
  placement_id: string;
  requisition_id: string;
  stage: string;
  first_name: string;
  last_initial: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  craft_name: string;
  level_name: string;
  years_experience: number | string | null;
  home_city: string | null;
  home_state: string | null;
  scheduled_start_date: string | null;
  actual_start_date: string | null;
  credential_ready: boolean;
};

const GROUPS: {
  key: string;
  title: string;
  sub: string;
  stages: string[];
  tone: string;
}[] = [
  {
    key: "review",
    title: "Awaiting your review",
    sub: "Put forward by US Trades. Nothing moves until you decide.",
    stages: ["submitted_to_customer", "customer_reviewing"],
    tone: "pending",
  },
  {
    key: "onboarding",
    title: "Clearing to start",
    sub: "Approved and working through badging, screening and safety council.",
    stages: ["customer_approved", "onboarding", "confirmed"],
    tone: "scheduled",
  },
  {
    key: "onsite",
    title: "On site",
    sub: "Currently working.",
    stages: ["started"],
    tone: "working",
  },
  {
    key: "finished",
    title: "Finished",
    sub: "Completed, ended early, or did not start.",
    stages: ["completed", "ended_early", "no_show", "customer_declined", "removed", "withdrawn"],
    tone: "inactive",
  },
];

export default async function CustomerWorkersPage() {
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

  const [{ data: rows }, { data: reqs }] = await Promise.all([
    only(supabase.from("customer_candidate_view").select("*"))
      .order("scheduled_start_date", { nullsFirst: false })
      .returns<Row[]>(),
    only(supabase.from("requisitions").select("id, req_number")),
  ]);

  const numberFor = new Map((reqs ?? []).map((r) => [r.id, r.req_number]));
  const all = rows ?? [];

  return (
    <>
      <div className="panel-head" style={{ marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 24 }}>Your workforce</h2>
          <div className="sub">
            Everyone US Trades has put forward, is clearing, or has on your
            sites.
          </div>
        </div>
      </div>

      {all.length === 0 && (
        <div className="panel">
          <p style={{ margin: 0, color: "var(--steel)" }}>
            Nobody has been submitted to you yet. Candidates appear here the
            moment US Trades puts them forward — you will not see who they are
            screening before then.
          </p>
        </div>
      )}

      {GROUPS.map((g) => {
        const group = all.filter((r) => g.stages.includes(r.stage));
        if (group.length === 0) return null;
        return (
          <div className="panel" key={g.key}>
            <div className="panel-head">
              <div>
                <h2>{g.title}</h2>
                <div className="sub">{g.sub}</div>
              </div>
              <span className={`badge ${g.tone}`}>{group.length}</span>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th style={{ width: 210 }}>Craft &amp; level</th>
                  <th style={{ width: 150 }}>Home</th>
                  <th style={{ width: 150 }}>Request</th>
                  <th style={{ width: 130 }}>
                    {g.key === "onsite" ? "Started" : "Start"}
                  </th>
                  {g.key === "onboarding" && (
                    <th style={{ width: 120 }}>Credentials</th>
                  )}
                  {(g.key === "onboarding" || g.key === "onsite") && (
                    <th style={{ width: 140 }} />
                  )}
                </tr>
              </thead>
              <tbody>
                {group.map((r) => (
                  <tr key={r.placement_id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {r.first_name} {r.last_name ?? r.last_initial}
                      </div>
                      {r.phone && (
                        <div className="mono" style={{ fontSize: 11.5, color: "var(--steel)" }}>
                          {r.phone}
                        </div>
                      )}
                    </td>
                    <td style={{ color: "var(--steel)" }}>
                      {r.craft_name} · {r.level_name}
                      {r.years_experience ? (
                        <span style={{ color: "var(--steel-dim)" }}>
                          {" "}
                          · {Number(r.years_experience)} yrs
                        </span>
                      ) : null}
                    </td>
                    <td style={{ color: "var(--steel)" }}>
                      {[r.home_city, r.home_state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td>
                      <Link
                        href={`/requisitions/${r.requisition_id}`}
                        className="mono"
                        style={{
                          fontSize: 12,
                          color: "var(--ink)",
                          textDecoration: "none",
                          borderBottom: "1px dotted var(--steel)",
                        }}
                      >
                        {numberFor.get(r.requisition_id) ?? "—"}
                      </Link>
                    </td>
                    <td className="mono" style={{ fontSize: 12.5 }}>
                      {formatDate(
                        g.key === "onsite"
                          ? (r.actual_start_date ?? r.scheduled_start_date)
                          : r.scheduled_start_date,
                      )}
                    </td>
                    {g.key === "onboarding" && (
                      <td>
                        <span
                          className={`badge ${r.credential_ready ? "approved" : "pending"}`}
                        >
                          {r.credential_ready ? "Ready" : "Outstanding"}
                        </span>
                      </td>
                    )}
                    {(g.key === "onboarding" || g.key === "onsite") && (
                      <td>
                        <OnSiteControls
                          placementId={r.placement_id}
                          stage={r.stage}
                          workerName={`${r.first_name} ${r.last_name ?? r.last_initial}`}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {all.length > 0 && (
        <div className="hint">
          Names are shown as first name and last initial unless your account is
          set up for full details. Ask your US Trades rep if you need more.
        </div>
      )}
    </>
  );
}
