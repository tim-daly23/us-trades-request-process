/** Shared display formatting. Keep every date/money format decision here. */

/**
 * Dates from Postgres `date` columns arrive as "YYYY-MM-DD" with no timezone.
 * Passing that to new Date() parses it as UTC midnight, which renders as the
 * *previous* day anywhere west of Greenwich — including every US site. Parse
 * the parts explicitly instead.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Timestamps are true instants, so the default parse is correct for them. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

/** "in 12 days" / "3 days ago" / "today" — for start and needed-by dates. */
export function relativeDays(value: string | null | undefined): string | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

/**
 * Work schedule, days first: "6 days × 10 hrs".
 *
 * Days lead because that is how a turnaround schedule is spoken on site.
 * Used by the requisition detail, the request form, the agency console and the
 * confirmation email — keep it here so all four stay identical.
 *
 * Postgres numeric columns can arrive as "10.00", so both values are
 * normalized before display.
 */
export function formatSchedule(
  daysPerWeek: number | string | null | undefined,
  hoursPerDay: number | string | null | undefined,
): string {
  const days = toNumber(daysPerWeek);
  const hours = toNumber(hoursPerDay);
  if (days === null && hours === null) return "—";

  const dayPart =
    days === null ? null : `${trim(days)} ${days === 1 ? "day" : "days"}`;
  const hourPart =
    hours === null ? null : `${trim(hours)} ${hours === 1 ? "hr" : "hrs"}`;

  return [dayPart, hourPart].filter(Boolean).join(" × ");
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

/** 10.00 -> "10", 9.50 -> "9.5" */
function trim(n: number): string {
  return String(Number(n.toFixed(2)));
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * What a request is called on screen.
 *
 * A title is optional — nobody should have to name a job twice — so this falls
 * back through the things that already describe it: the project name, then what
 * was actually asked for, then the site. Only a request with none of those
 * shows its number, and every request has one of those.
 */
export function requisitionLabel(parts: {
  title?: string | null;
  projectName?: string | null;
  craftSummary?: string | null;
  siteName?: string | null;
  reqNumber?: string | null;
}): string {
  const title = parts.title?.trim();
  if (title) return title;

  const project = parts.projectName?.trim();
  if (project) return project;

  const craft = parts.craftSummary?.trim();
  if (craft) {
    return parts.siteName ? `${craft} — ${parts.siteName}` : craft;
  }

  const site = parts.siteName?.trim();
  if (site) return `Manpower request — ${site}`;

  return parts.reqNumber ?? "Request";
}
