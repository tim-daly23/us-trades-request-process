/**
 * Status pill.
 *
 * Square, flat, small — matching the design canvas. Colour is never the only
 * carrier: the label is always spelled out.
 */
const LABELS: Record<string, string> = {
  pending_approval: "Awaiting approval",
  partially_filled: "Partially filled",
  active: "On site",
  on_hold: "On hold",
};

const STYLES: Record<string, string> = {
  draft: "border border-dashed border-faint text-muted-2",
  pending_approval: "bg-warn-soft text-warn-soft-fg",
  submitted: "bg-neutral-soft text-neutral-soft-fg",
  acknowledged: "bg-brand-soft text-brand-soft-fg",
  sourcing: "bg-brand-soft text-brand-soft-fg",
  partially_filled: "bg-brand-soft text-brand-soft-fg",
  filled: "bg-ok-soft text-ok-soft-fg",
  active: "bg-ok-soft text-ok-soft-fg",
  on_hold: "bg-warn-soft text-warn-soft-fg",
  completed: "bg-neutral-soft text-neutral-soft-fg",
  cancelled: "bg-neutral-soft text-neutral-soft-fg",
};

function label(status: string) {
  return (
    LABELS[status] ??
    status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center px-2 py-[3px] text-[11px] font-medium ${
        STYLES[status] ?? STYLES.draft
      }`}
    >
      {label(status)}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  if (urgency === "standard") return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center px-2 py-[3px] text-[11px] font-medium ${
        urgency === "emergency"
          ? "bg-danger-soft text-danger-soft-fg"
          : "bg-warn-soft text-warn-soft-fg"
      }`}
    >
      {urgency === "emergency" ? "Emergency" : "Urgent"}
    </span>
  );
}
