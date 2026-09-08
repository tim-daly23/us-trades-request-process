"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

const nz = (v: FormDataEntryValue | null): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
const num = (v: FormDataEntryValue | null): number | null => {
  const s = nz(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";

/**
 * Who may write to the job log.
 *
 * Everyone at the customer except viewers, plus US Trades — the log is shared
 * on purpose, so a job number can be agreed without an email. RLS enforces the
 * same rule; this exists to fail early with a sentence rather than a policy
 * violation.
 */
async function whoCanWrite(): Promise<
  { ok: true; customerId: string | null; isAgency: boolean } | { ok: false; error: string }
> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.user_type === "agency") {
    return { ok: true, customerId: null, isAgency: true };
  }
  if (profile.customer_role === "viewer") {
    return { ok: false, error: "Viewers cannot change the job log." };
  }
  return { ok: true, customerId: profile.customer_id, isAgency: false };
}

function fields(form: FormData) {
  return {
    job_number: nz(form.get("job_number")),
    date_created: nz(form.get("date_created")),
    status: nz(form.get("status")) ?? "Pending",
    end_customer: nz(form.get("end_customer")),
    description: nz(form.get("description")),
    site_name: nz(form.get("site_name")),
    location: nz(form.get("location")),
    gps_coordinates: nz(form.get("gps_coordinates")),
    project_manager: nz(form.get("project_manager")),
    site_contact_name: nz(form.get("site_contact_name")),
    site_contact_phone: nz(form.get("site_contact_phone")),
    per_diem_rate: num(form.get("per_diem_rate")),
    twic_required: bool(form.get("twic_required")),
    notes: nz(form.get("notes")),
  };
}

export async function createJob(form: FormData): Promise<Result> {
  const guard = await whoCanWrite();
  if (!guard.ok) return guard;

  const f = fields(form);
  if (!f.job_number) return { ok: false, error: "A job number is required." };

  // Agency staff say which customer; a customer user's own tenant is implied.
  const customerId = guard.isAgency ? nz(form.get("customer_id")) : guard.customerId;
  if (!customerId) return { ok: false, error: "Choose a customer." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_jobs")
    .insert({ ...f, customer_id: customerId });

  if (error) {
    return {
      ok: false,
      error: error.message.includes("duplicate")
        ? `Job ${f.job_number} is already in the log.`
        : error.message,
    };
  }

  revalidatePath("/jobs");
  revalidatePath(`/agency/customers/${customerId}`);
  return { ok: true };
}

export async function updateJob(form: FormData): Promise<Result> {
  const guard = await whoCanWrite();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  if (!id) return { ok: false, error: "Missing job." };

  const supabase = await createClient();
  const { error } = await supabase.from("customer_jobs").update(fields(form)).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/jobs");
  return { ok: true };
}

/**
 * Soft delete. A job number that appeared on a request should stay resolvable
 * afterwards, so the row is hidden rather than destroyed.
 */
export async function deleteJob(form: FormData): Promise<Result> {
  const guard = await whoCanWrite();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  if (!id) return { ok: false, error: "Missing job." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_jobs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/jobs");
  return { ok: true };
}
