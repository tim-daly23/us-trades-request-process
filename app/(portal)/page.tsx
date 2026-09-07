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

  const fillFor = new Map((fills ?? []).map((f) => [f.requisition_id, f]));

  if (error) {
    return (
      <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Could not load requisitions: {error.message}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Requisitions</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {reqs?.length ?? 0} total
          </p>
        </div>
        <Link
          href="/requisitions/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          New request
        </Link>
      </div>

      {!reqs?.length ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-sm font-medium">No requisitions yet</p>
          <p className="mt-1 text-sm text-neutral-500">
            Start a request and it will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reqs.map((r) => {
            const fill = fillFor.get(r.id);
            const due = relativeDays(r.start_date);
            return (
              <li key={r.id}>
                <Link
                  href={`/requisitions/${r.id}`}
                  className="block rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-neutral-500">
                          {r.req_number}
                        </span>
                        <StatusBadge status={r.status} />
                        <UrgencyBadge urgency={r.urgency} />
                      </div>
                      <h2 className="mt-1 truncate font-medium">
                        {r.title ?? "Untitled request"}
                      </h2>
                      <p className="mt-0.5 text-sm text-neutral-500">
                        {r.site
                          ? `${r.site.name} · ${r.site.city}, ${r.site.state}`
                          : "No site"}
                      </p>
                    </div>

                    <div className="text-right text-sm">
                      <p className="font-medium">{formatDate(r.start_date)}</p>
                      <p className="text-neutral-500">{due ?? "—"}</p>
                    </div>
                  </div>

                  {fill && fill.total_requested > 0 && (
                    <div className="mt-3 max-w-xs">
                      <FillProgress
                        requested={fill.total_requested}
                        filled={fill.total_filled}
                        onboarding={fill.total_onboarding}
                      />
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
