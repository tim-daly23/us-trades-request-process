/**
 * Where one worker stands, in the customer's language.
 *
 * The pipeline has sixteen stages; a customer needs four ideas — we have put
 * them forward, you approved them, they are clearing, they are working. The
 * internal stages never reach here because the view they come from filters
 * them out, so there is nothing to translate for those.
 */
const STAGE: Record<string, { label: string; tone: string }> = {
  submitted_to_customer: { label: "For your review", tone: "pending" },
  customer_reviewing: { label: "For your review", tone: "pending" },
  customer_approved: { label: "Approved", tone: "scheduled" },
  customer_declined: { label: "Declined", tone: "declined" },
  onboarding: { label: "Clearing to start", tone: "scheduled" },
  confirmed: { label: "Cleared", tone: "scheduled" },
  started: { label: "On site", tone: "working" },
  completed: { label: "Completed", tone: "inactive" },
  ended_early: { label: "Ended early", tone: "inactive" },
  no_show: { label: "Did not start", tone: "declined" },
  withdrawn: { label: "Withdrew", tone: "inactive" },
  removed: { label: "Removed", tone: "inactive" },
};

export function PlacementStageBadge({ stage }: { stage: string }) {
  const s = STAGE[stage] ?? { label: stage.replace(/_/g, " "), tone: "inactive" };
  return <span className={`badge ${s.tone}`}>{s.label}</span>;
}
