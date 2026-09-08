/** Shapes shared between the request form and its server action. */

export type SiteOption = {
  id: string;
  customer_id: string;
  name: string;
  city: string;
  state: string;
  default_shift: string | null;
  default_hours_per_day: number | string | null;
  default_days_per_week: number | null;
  default_per_diem_rate: number | string | null;
  safety_council_required: boolean | null;
  safety_council_name: string | null;
  default_credential_ids: string[] | null;
};

export type CustomerOption = { id: string; display_name: string };

export type JobOption = {
  id: string;
  customer_id: string;
  job_number: string;
  end_customer: string | null;
  description: string | null;
  per_diem_rate: number | string | null;
  twic_required: boolean;
};

export type CraftOption = { id: string; name: string; category: string | null };
export type LevelOption = { id: string; name: string; rank: number };

export type CredentialOption = {
  id: string;
  /** Needed so the form can react to a job requiring TWIC. */
  code: string;
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
  /** Agency staff raise requests on a customer's behalf, so they name one.
   *  Ignored for customer users, whose tenant comes from their profile. */
  customerId?: string;
  /** The customer's own job number this request belongs to, if any. */
  jobId: string;
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
