/**
 * The four statuses anyone actually cares about.
 *
 * The database keeps a longer lifecycle enum — draft, submitted, acknowledged,
 * sourcing, partially_filled, filled, active, on_hold, completed, cancelled —
 * but most of those are either bookkeeping or a claim someone has to remember
 * to update. Sourcing in particular drifts: a request sits marked "sourcing"
 * long after it is fully crewed.
 *
 * So the displayed status is derived. Pending and Acknowledged come from
 * whether US Trades has taken the request on; Partially Filled and Filled come
 * from the actual counts. It cannot disagree with the data because it is the
 * data.
 *
 * Draft, Completed and Cancelled pass through: they are not points on the fill
 * journey, they are before it and after it.
 */
export type DisplayStatus =
  | "draft"
  | "pending"
  | "acknowledged"
  | "partially_filled"
  | "filled"
  | "completed"
  | "cancelled";

export function displayStatus(input: {
  status: string;
  requested?: number | null;
  filled?: number | null;
}): DisplayStatus {
  const { status } = input;

  if (status === "draft") return "draft";
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";

  const requested = input.requested ?? 0;
  const filled = input.filled ?? 0;

  if (requested > 0 && filled >= requested) return "filled";
  if (filled > 0) return "partially_filled";

  // Nobody placed yet: has US Trades taken it on, or is it still with them?
  return status === "submitted" || status === "pending_approval"
    ? "pending"
    : "acknowledged";
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  acknowledged: "Acknowledged",
  partially_filled: "Partially filled",
  filled: "Filled",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Maps onto the shared badge tones from the dashboard's design system. */
export const STATUS_TONE: Record<DisplayStatus, string> = {
  draft: "inactive",
  pending: "pending",
  acknowledged: "submitted",
  partially_filled: "scheduled",
  filled: "approved",
  completed: "inactive",
  cancelled: "declined",
};
