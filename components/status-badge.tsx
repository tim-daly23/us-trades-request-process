/**
 * Status badge, using the dashboard's badge vocabulary so a status reads the
 * same in both products: tinted background, matching border, Barlow Condensed.
 */
const LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Awaiting approval",
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  sourcing: "Sourcing",
  partially_filled: "Partially filled",
  filled: "Filled",
  active: "On site",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Maps a requisition status onto one of the shared badge tones. */
const TONES: Record<string, string> = {
  draft: "inactive",
  pending_approval: "pending",
  submitted: "submitted",
  acknowledged: "submitted",
  sourcing: "scheduled",
  partially_filled: "scheduled",
  filled: "approved",
  active: "working",
  on_hold: "pending",
  completed: "inactive",
  cancelled: "inactive",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${TONES[status] ?? "inactive"}`}>
      {LABELS[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  if (urgency === "standard") return null;
  return (
    <span className={`badge ${urgency === "emergency" ? "declined" : "pending"}`}>
      {urgency === "emergency" ? "Emergency" : "Urgent"}
    </span>
  );
}
