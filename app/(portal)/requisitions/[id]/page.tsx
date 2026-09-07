import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, UrgencyBadge } from "@/components/status-badge";
import { FillProgress } from "@/components/fill-progress";
import { formatDate, formatMoney, titleCase } from "@/lib/format";

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
                  reporting_location, badging_lead_time_days,
                  safety_council_required, safety_council_name)`,
    )
    .eq("id", id)
    .maybeSingle();

  // RLS returns nothing rather than erroring for another tenant's row, so a
  // missing record and a forbidden one are indistinguishable here — which is
  // the correct thing to show a user either way.
  if (!req) notFound();

  const site = Array.isArray(req.site) ? req.site[0] : req.site;

  const [{ data: lines }, { data: reqs }] = await Promise.all([
    supabase
      .from("requisition_lines_visible")
      .select("*")
      .eq("requisition_id", id)
      .order("line_number")
      .returns<Line[]>(),
    supabase
      .from("requisition_requirements")
      .select("is_required, state_code, credential:credentials(name, short_label)")
      .eq("requisition_id", id),
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
    <div className="space-y-8">
      <div>
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          ← All requisitions
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-neutral-500">
            {req.req_number}
          </span>
          <StatusBadge status={req.status} />
          <UrgencyBadge urgency={req.urgency} />
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {req.title ?? "Untitled request"}
        </h1>
        {site && (
          <p className="mt-0.5 text-sm text-neutral-500">
            {site.name} · {site.address_line1}, {site.city}, {site.state}{" "}
            {site.postal_code}
          </p>
        )}
      </div>

      {totals.requested > 0 && (
        <div className="max-w-sm">
          <FillProgress
            requested={totals.requested}
            filled={totals.filled}
            onboarding={totals.onboarding}
          />
        </div>
      )}

      <section className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Start" value={formatDate(req.start_date)} />
        <Field label="End" value={formatDate(req.end_date)} />
        <Field
          label="Duration"
          value={req.duration_weeks ? `${req.duration_weeks} weeks` : "—"}
        />
        <Field label="Shift" value={titleCase(req.shift)} />
        <Field
          label="Schedule"
          value={`${req.hours_per_day}h × ${req.days_per_week} days`}
        />
        <Field label="Per diem" value={formatMoney(req.per_diem_rate)} />
        <Field label="Project" value={req.project_name ?? "—"} />
        <Field label="PO" value={req.po_number ?? "—"} />
        <Field
          label="Reporting"
          value={site?.reporting_location ?? "—"}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Craft requested
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-lg text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
                <th className="py-2 font-medium">Craft</th>
                <th className="py-2 font-medium">Level</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 font-medium">Progress</th>
                {showRates && (
                  <th className="py-2 text-right font-medium">Bill rate</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(lines ?? []).map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-neutral-100 dark:border-neutral-800/60"
                >
                  <td className="py-3 font-medium">{l.craft_name}</td>
                  <td className="py-3 text-neutral-600 dark:text-neutral-400">
                    {l.level_name}
                  </td>
                  <td className="py-3 text-right tabular-nums">{l.quantity}</td>
                  <td className="w-40 py-3">
                    <FillProgress
                      requested={l.quantity}
                      filled={l.filled_count}
                      onboarding={l.onboarding_count}
                    />
                  </td>
                  {showRates && (
                    <td className="py-3 text-right tabular-nums">
                      {formatMoney(l.bill_rate)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!!reqs?.length && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Credentials required
          </h2>
          <ul className="flex flex-wrap gap-2">
            {reqs.map((r, i) => {
              const cred = Array.isArray(r.credential)
                ? r.credential[0]
                : r.credential;
              return (
                <li
                  key={i}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    r.is_required
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                  }`}
                >
                  {cred?.short_label ?? cred?.name}
                  {r.state_code ? ` (${r.state_code})` : ""}
                  {!r.is_required && " · preferred"}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(req.scope_of_work || req.special_instructions) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Scope
          </h2>
          {req.scope_of_work && (
            <p className="text-sm leading-relaxed">{req.scope_of_work}</p>
          )}
          {req.special_instructions && (
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {req.special_instructions}
            </p>
          )}
        </section>
      )}

      {site?.safety_council_required && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          Site requires {site.safety_council_name ?? "safety council"} training.
          Allow {site.badging_lead_time_days ?? 3} days for badging.
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}
