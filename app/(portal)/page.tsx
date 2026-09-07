import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
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

/** "Pipefitter Journeyman ×4 · Welder Foreman ×1" */
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
      <div className="p-6">
        <p className="border border-danger/40 bg-danger-soft p-4 text-sm text-danger-soft-fg">
          Could not load requisitions: {error.message}
        </p>
      </div>
    );
  }

  const rows = reqs ?? [];
  const fillFor = new Map((fills ?? []).map((f) => [f.requisition_id, f]));
  const linesFor = new Map<string, LineRow[]>();
  for (const l of lines ?? []) {
    linesFor.set(l.requisition_id, [...(linesFor.get(l.requisition_id) ?? []), l]);
  }

  const counts = {
    all: rows.length,
    open: rows.filter((r) => OPEN.has(r.status)).length,
    onSite: rows.filter((r) => ON_SITE.has(r.status)).length,
    drafts: rows.filter((r) => r.status === "draft").length,
    completed: rows.filter((r) => r.status === "completed").length,
  };
  const seats = rows
    .filter((r) => !["completed", "cancelled"].includes(r.status))
    .reduce((n, r) => n + (fillFor.get(r.id)?.total_requested ?? 0), 0);

  return (
    <div className="flex flex-col">
      {/* Page header + tabs */}
      <div className="border-b border-line bg-surface">
        <div className="flex items-start justify-between gap-4 px-[26px] pt-[18px]">
          <div>
            <h1 className="text-[22px] font-medium tracking-[-0.012em]">
              Manpower requests
            </h1>
            <p className="mt-1 text-[12.5px] text-muted">
              {counts.all} request{counts.all === 1 ? "" : "s"} · {counts.open}{" "}
              open · {seats} seat{seats === 1 ? "" : "s"} requested
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-0.5 px-[26px]">
          <Tab active count={counts.all}>
            All
          </Tab>
          <Tab count={counts.open}>Open</Tab>
          <Tab count={counts.onSite}>On site</Tab>
          <Tab count={counts.drafts}>Drafts</Tab>
          <Tab count={counts.completed}>Completed</Tab>
        </div>
      </div>

      {/* Table */}
      <div className="p-[18px_26px]">
        <div className="flex flex-col border border-line bg-surface">
          <div className="flex h-[34px] shrink-0 items-center border-b border-line bg-surface-muted px-4 text-[10.5px] uppercase tracking-[0.09em] text-[#8A919C]">
            <div className="w-[132px]">Request</div>
            <div className="w-[218px]">Site</div>
            <div className="w-[84px]">Start</div>
            <div className="w-[72px]">Duration</div>
            <div className="flex-1">Craft &amp; level</div>
            <div className="w-[138px]">Seats filled</div>
            <div className="w-[124px]">Status</div>
          </div>

          {rows.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="text-sm font-medium">No requests yet</p>
              <p className="mt-1 text-[12.5px] text-muted">
                Raise one and it will appear here.
              </p>
              <Link
                href="/requisitions/new"
                className="mt-4 inline-flex h-[33px] items-center bg-accent px-3.5 text-[13px] font-medium text-accent-fg"
              >
                New request
              </Link>
            </div>
          ) : (
            rows.map((r) => {
              const fill = fillFor.get(r.id);
              const isDraft = r.status === "draft";
              const dim = ["completed", "cancelled"].includes(r.status);
              return (
                <Link
                  key={r.id}
                  href={`/requisitions/${r.id}`}
                  className="flex h-[54px] items-center border-b border-line-soft px-4 text-[13px] transition last:border-0 hover:bg-surface-muted"
                >
                  <div className="flex w-[132px] flex-col gap-0.5">
                    <span
                      className={`num text-[12px] font-medium ${isDraft ? "text-muted-3" : "text-brand"}`}
                    >
                      {isDraft ? "Draft" : r.req_number}
                    </span>
                    <span className="truncate text-[11px] text-muted-3">
                      {r.title ?? "Untitled"}
                    </span>
                  </div>

                  <div
                    className={`w-[218px] truncate pr-3 ${dim ? "text-muted" : ""}`}
                  >
                    {r.site ? r.site.name : "—"}
                  </div>

                  <div className="num w-[84px] text-[12px]">
                    {formatDate(r.start_date).replace(/,.*$/, "")}
                  </div>

                  <div className="num w-[72px] text-[12px] text-muted">
                    {r.is_ongoing
                      ? "Ongoing"
                      : r.duration_weeks
                        ? `${Number(r.duration_weeks)} wks`
                        : "—"}
                  </div>

                  <div className="flex-1 truncate pr-3 text-[12.5px] text-[#4A515C]">
                    {summarizeLines(linesFor.get(r.id) ?? []) || "—"}
                  </div>

                  <div className="w-[138px]">
                    {fill && fill.total_requested > 0 ? (
                      <FillProgress
                        requested={fill.total_requested}
                        filled={fill.total_filled}
                        onboarding={fill.total_onboarding}
                      />
                    ) : (
                      <span className="num text-[12px] text-faint">—</span>
                    )}
                  </div>

                  <div className="w-[124px]">
                    <StatusBadge status={r.status} />
                  </div>
                </Link>
              );
            })
          )}

          <div className="flex h-11 shrink-0 items-center justify-between border-t border-line bg-surface-muted px-4">
            <span className="text-[12.5px] text-muted-2">
              {rows.length} of {rows.length} request
              {rows.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tab({
  children,
  count,
  active,
}: {
  children: string;
  count: number;
  active?: boolean;
}) {
  return (
    <span
      className={`border-b-2 px-3.5 py-2.5 text-[13px] ${
        active
          ? "border-accent font-medium text-foreground"
          : "border-transparent text-muted"
      }`}
    >
      {children}{" "}
      <span className="num font-normal text-muted-2">{count}</span>
    </span>
  );
}
