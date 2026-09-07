import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, UrgencyBadge } from "@/components/status-badge";
import { FillProgress } from "@/components/fill-progress";
import { formatDate, relativeDays } from "@/lib/format";

type SiteRef = { name: string; city: string; state: string } | null;

type Requisition = {
  id: string;
  req_number: string;
  title: string | null;
  status: string;
  urgency: string;
  start_date: string;
  end_date: string | null;
  needed_by: string | null;
  site: SiteRef;
};

type FillRow = {
  requisition_id: string;
  total_requested: number;
  total_filled: number;
  total_onboarding: number;
};

const CLOSED = new Set(["completed", "cancelled"]);

export default async function RequisitionsPage() {
  const supabase = await createClient();

  // RLS scopes both of these to the caller's tenant; no customer_id filter here.
  const [{ data: reqs, error }, { data: fills }] = await Promise.all([
    supabase
      .from("requisitions")
      .select(
        "id, req_number, title, status, urgency, start_date, end_date, needed_by, site:sites(name, city, state)",
      )
      .order("start_date", { ascending: true })
      .returns<Requisition[]>(),
    supabase.from("requisition_fill_summary").select("*").returns<FillRow[]>(),
  ]);

  if (error) {
    return (
      <p className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        Could not load requisitions: {error.message}
      </p>
    );
  }

  const fillFor = new Map((fills ?? []).map((f) => [f.requisition_id, f]));
  const open = (reqs ?? []).filter((r) => !CLOSED.has(r.status));

  const totals = open.reduce(
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Requisitions</h1>
          <p className="mt-1 text-sm text-muted">
            Manpower requests and their fill status.
          </p>
        </div>
        <Link
          href="/requisitions/new"
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg shadow-sm transition hover:brightness-95"
        >
          New request
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Open requests" value={open.length} />
        <Stat label="Workers requested" value={totals.requested} />
        <Stat label="Filled" value={totals.filled} tone="ok" />
        <Stat label="In onboarding" value={totals.onboarding} tone="warn" />
      </section>

      {!reqs?.length ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-14 text-center">
          <p className="font-medium">No requisitions yet</p>
          <p className="mt-1 text-sm text-muted">
            Start a request and it will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reqs.map((r) => {
            const fill = fillFor.get(r.id);
            const when = relativeDays(r.start_date);
            const soon =
              !CLOSED.has(r.status) &&
              when !== null &&
              (when.includes("ago") || /in [0-9] days|today|tomorrow/.test(when));

            return (
              <li key={r.id}>
                <Link
                  href={`/requisitions/${r.id}`}
                  className="group flex gap-0 overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition hover:border-brand/40 hover:shadow-md"
                >
                  {/* Brand rail: gives each row a spine and a hover target. */}
                  <span className="w-1 shrink-0 bg-brand/70 transition group-hover:bg-accent" />

                  <div className="flex flex-1 flex-wrap items-start justify-between gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted">
                          {r.req_number}
                        </span>
                        <StatusBadge status={r.status} />
                        <UrgencyBadge urgency={r.urgency} />
                      </div>

                      <h2 className="mt-1.5 truncate text-base font-semibold">
                        {r.title ?? "Untitled request"}
                      </h2>

                      <p className="mt-0.5 text-sm text-muted">
                        {r.site
                          ? `${r.site.name} · ${r.site.city}, ${r.site.state}`
                          : "No site"}
                      </p>

                      {fill && fill.total_requested > 0 && (
                        <div className="mt-3 max-w-xs">
                          <FillProgress
                            requested={fill.total_requested}
                            filled={fill.total_filled}
                            onboarding={fill.total_onboarding}
                          />
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs uppercase tracking-wide text-muted">
                        Starts
                      </p>
                      <p className="tnum text-sm font-semibold">
                        {formatDate(r.start_date)}
                      </p>
                      {when && (
                        <p
                          className={`text-xs ${soon ? "font-medium text-warn" : "text-muted"}`}
                        >
                          {when}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  const color =
    tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-foreground";
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`tnum mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
