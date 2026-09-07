import { titleCase } from "@/lib/format";

/**
 * Requisition status pill.
 *
 * Colour carries meaning, so it must not be the only carrier — the label is
 * always spelled out for anyone who cannot distinguish the hues.
 */
const STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  pending_approval: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  acknowledged: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  sourcing: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  partially_filled: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  filled: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  active: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  on_hold: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  completed: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  cancelled: "bg-neutral-100 text-neutral-500 line-through dark:bg-neutral-800 dark:text-neutral-500",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.draft;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {titleCase(status)}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  if (urgency === "standard") return null;
  const style =
    urgency === "emergency"
      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
      : "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {titleCase(urgency)}
    </span>
  );
}
