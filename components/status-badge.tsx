import {
  displayStatus,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/lib/request-status";

/**
 * Request status, derived rather than displayed raw.
 *
 * Pass the fill counts and the badge reflects reality — a fully crewed request
 * reads "Filled" whether or not anyone remembered to move it off "sourcing".
 */
export function StatusBadge({
  status,
  requested,
  filled,
}: {
  status: string;
  requested?: number | null;
  filled?: number | null;
}) {
  const key = displayStatus({ status, requested, filled });
  return (
    <span className={`badge ${STATUS_TONE[key]}`}>{STATUS_LABEL[key]}</span>
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
