import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, UrgencyBadge } from "@/components/status-badge";
import { PlacementStageBadge } from "@/components/placement-stage-badge";
import { OnSiteControls } from "@/components/onsite-controls";
import { StartDateCell } from "@/components/start-date-cell";
import { FillProgress } from "@/components/fill-progress";
import {
  formatDate,
  formatMoney,
  formatSchedule,
  requisitionLabel,
  titleCase,
} from "@/lib/format";

type Line = {
  id: string;
  line_number: number;
  quantity: number;
  filled_count: number;
  onboarding_count: number;
  status: string;
  bill_rate: number | null;
  per_diem_rate: number | null;
  craft_name: string;
  level_name: string;
};

export default async function RequisitionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: req } = await supabase
    .from("requisitions")
    .select(
      `id, req_number, title, project_name, po_number, status, urgency,
       start_date, end_date, duration_weeks, shift, hours_per_day, days_per_week,
       per_diem_rate, scope_of_work, special_instructions, submitted_at,
       site:sites(name, address_line1, city, state, postal_code,
                  contacts:site_contacts(name, phone, role, is_primary))`,
    )
    .eq("id", id)
    .maybeSingle();

  // RLS returns nothing rather than erroring for another tenant's row, so a
  // missing record and a forbidden one are indistinguishable here — which is
  // the correct thing to show a user either way.
  if (!req) notFound();

  const site = Array.isArray(req.site) ? req.site[0] : req.site;

  // The primary site contact, shown so a customer can see who US Trades will
  // be dealing with at the gate.
  const siteContacts = (site?.contacts ?? []) as {
    name: string;
    phone: string | null;
    role: string | null;
    is_primary: boolean;
  }[];
  const primaryContact =
    siteContacts.find((c) => c.is_primary) ?? siteContacts[0];
  const contactLine = primaryContact
    ? `${primaryContact.name}${primaryContact.phone ? ` · ${primaryContact.phone}` : ""}`
    : "—";

  const [{ data: lines }, { data: reqs }, { data: crew }] = await Promise.all([
    supabase
      .from("requisition_lines_visible")
      .select("*")
      .eq("requisition_id", id)
      .order("line_number")
      .returns<Line[]>(),
    supabase
      .from("requisition_requirements")
      .select(
        "is_required, state_code, credential:credentials(name, short_label)",
      )
      .eq("requisition_id", id),
    // Only ever through the view: it filters to placements actually submitted
    // to this customer and redacts names per their account settings.
    supabase
      .from("customer_candidate_view")
      .select(
        "placement_id, stage, first_name, last_initial, last_name, phone, craft_name, level_name, scheduled_start_date, actual_start_date",
      )
      .eq("requisition_id", id)
      .order("scheduled_start_date", { nullsFirst: false }),
  ]);

  const totals = (lines ?? []).reduce(
    (acc, l) => ({
      requested: acc.requested + l.quantity,
      filled: acc.filled + l.filled_count,
      onboarding: acc.onboarding + l.onboarding_count,
    }),
    { requested: 0, filled: 0, onboarding: 0 },
  );

  // bill_rate is nulled by the view for roles that may not see rates, so its
  // presence — not the user's role — decides whether the column renders.
  const showRates = (lines ?? []).some((l) => l.bill_rate !== null);

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <Link
          href="/requests"
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

      <div className="panel">
        <div className="panel-head">
          <div>
            <div
              className="mono"
              style={{ fontSize: 12.5, color: "var(--steel)" }}
            >
              {req.req_number}
            </div>
            <h2>
              {requisitionLabel({
                title: req.title,
                projectName: req.project_name,
                craftSummary: (lines ?? [])
                  .map((l) => `${l.craft_name} ${l.level_name} ×${l.quantity}`)
                  .join(" · "),
                siteName: site?.name,
                reqNumber: req.req_number,
              })}
            </h2>
            {site && (
              <div className="sub">
                {site.name} · {site.address_line1}, {site.city}, {site.state}{" "}
                {site.postal_code}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <StatusBadge
              status={req.status}
              requested={totals.requested}
              filled={totals.filled}
            />
            <UrgencyBadge urgency={req.urgency} />
          </div>
        </div>

        {totals.requested > 0 && (
          <div style={{ maxWidth: 320, marginBottom: 18 }}>
            <FillProgress
              requested={totals.requested}
              filled={totals.filled}
              onboarding={totals.onboarding}
              layout="stacked"
            />
          </div>
        )}

        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "14px 24px",
            margin: 0,
          }}
        >
          <Field label="Start" value={formatDate(req.start_date)} />
          <Field label="End" value={formatDate(req.end_date)} />
          <Field
            label="Duration"
            value={
              req.duration_weeks ? `${Number(req.duration_weeks)} weeks` : "—"
            }
          />
          <Field label="Shift" value={titleCase(req.shift)} />
          <Field
            label="Schedule"
            value={formatSchedule(req.days_per_week, req.hours_per_day)}
          />
          <Field label="Per diem" value={formatMoney(req.per_diem_rate)} />
          <Field label="Project" value={req.project_name ?? "—"} />
          <Field label="PO" value={req.po_number ?? "—"} />
          <Field label="Site contact" value={contactLine} />
        </dl>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Craft requested</h2>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Craft</th>
              <th style={{ width: 150 }}>Level</th>
              <th style={{ width: 60 }}>Qty</th>
              <th style={{ width: 170 }}>Quantity filled</th>
              {showRates && <th style={{ width: 110 }}>Bill rate</th>}
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => (
              <tr key={l.id}>
                <td style={{ fontWeight: 500 }}>{l.craft_name}</td>
                <td style={{ color: "var(--steel)" }}>{l.level_name}</td>
                <td className="mono">{l.quantity}</td>
                <td>
                  <FillProgress
                    requested={l.quantity}
                    filled={l.filled_count}
                    onboarding={l.onboarding_count}
                  />
                </td>
                {showRates && (
                  <td className="mono">{formatMoney(l.bill_rate)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!!crew?.length && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Crew</h2>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Worker</th>
                <th style={{ width: 220 }}>Craft &amp; level</th>
                <th style={{ width: 150 }}>Starts</th>
                <th style={{ width: 170 }}>Stage</th>
                <th style={{ width: 140 }} />
              </tr>
            </thead>
            <tbody>
              {crew.map((c) => (
                <tr key={c.placement_id}>
                  <td style={{ fontWeight: 500 }}>
                    {c.first_name} {c.last_name ?? c.last_initial}
                    {c.phone && (
                      <div className="mono" style={{ fontSize: 11.5, color: "var(--steel)" }}>
                        {c.phone}
                      </div>
                    )}
                  </td>
                  <td style={{ color: "var(--steel)" }}>
                    {c.craft_name} · {c.level_name}
                  </td>
                  <td>
                    <StartDateCell
                      placementId={c.placement_id}
                      stage={c.stage}
                      value={c.actual_start_date ?? c.scheduled_start_date}
                    />
                  </td>
                  <td>
                    <PlacementStageBadge stage={c.stage} />
                  </td>
                  <td>
                    <OnSiteControls
                      placementId={c.placement_id}
                      stage={c.stage}
                      workerName={`${c.first_name} ${c.last_name ?? c.last_initial}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!!reqs?.length && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Credentials required</h2>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {reqs.map((r, i) => {
              const cred = Array.isArray(r.credential)
                ? r.credential[0]
                : r.credential;
              return (
                <span
                  key={i}
                  className={`badge ${r.is_required ? "submitted" : "inactive"}`}
                >
                  {cred?.short_label ?? cred?.name}
                  {r.state_code ? ` (${r.state_code})` : ""}
                  {!r.is_required && " · preferred"}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {(req.scope_of_work || req.special_instructions) && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Scope</h2>
            </div>
          </div>
          {req.scope_of_work && (
            <p style={{ margin: 0, lineHeight: 1.6 }}>{req.scope_of_work}</p>
          )}
          {req.special_instructions && (
            <p
              style={{
                margin: "10px 0 0",
                lineHeight: 1.6,
                color: "var(--steel)",
              }}
            >
              {req.special_instructions}
            </p>
          )}
        </div>
      )}

    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        style={{
          fontSize: 12,
          color: "var(--steel)",
          marginBottom: 3,
          fontWeight: 500,
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: 13.5 }}>{value}</dd>
    </div>
  );
}
