/** Shapes shared between the request form and its server action. */

export type SiteOption = {
  id: string;
  name: string;
  site_code: string | null;
  city: string;
  state: string;
  default_shift: string | null;
  default_hours_per_day: number | string | null;
  default_days_per_week: number | null;
  default_per_diem_rate: number | string | null;
  badging_lead_time_days: number | null;
  safety_council_required: boolean | null;
  safety_council_name: string | null;
  default_credential_ids: string[] | null;
};

export type CraftOption = { id: string; name: string; category: string | null };
export type LevelOption = { id: string; name: string; rank: number };

export type CredentialOption = {
  id: string;
  label: string;
  /** Enforced by the customer's configuration; cannot be unchecked. */
  mandatory: boolean;
  defaultChecked: boolean;
  requiresState: boolean;
};

export type DraftLine = {
  /** Client-side row key only; not persisted. */
  key: string;
  craftId: string;
  levelId: string;
  quantity: number;
};

export type RequisitionInput = {
  siteId: string;
  title: string;
  projectName: string;
  poNumber: string;
  urgency: "standard" | "urgent" | "emergency";
  startDate: string;
  endDate: string;
  durationWeeks: string;
  shift: string;
  hoursPerDay: string;
  daysPerWeek: string;
  perDiemRate: string;
  scopeOfWork: string;
  specialInstructions: string;
  lines: { craftId: string; levelId: string; quantity: number }[];
  credentialIds: string[];
  /** false saves a draft the customer can keep editing. */
  submit: boolean;
};

export type ActionResult =
  | { ok: true; id: string; reqNumber: string | null; status: string }
  | { ok: false; error: string };
