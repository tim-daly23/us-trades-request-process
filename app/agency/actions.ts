"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAgency } from "@/lib/auth";

type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

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

// =====================================================================
// Customers
// =====================================================================

export async function createCustomer(form: FormData): Promise<Result<string>> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const slug = nz(form.get("slug"))?.toLowerCase();
  const legal = nz(form.get("legal_name"));
  const display = nz(form.get("display_name"));

  if (!slug || !legal || !display) {
    return { ok: false, error: "Slug, legal name and display name are required." };
  }
  if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(slug)) {
    return {
      ok: false,
      error:
        "Slug must be lowercase letters, numbers and hyphens — it becomes their subdomain and their request number prefix.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      slug,
      legal_name: legal,
      display_name: display,
      status: nz(form.get("status")) ?? "prospect",
      billing_email: nz(form.get("billing_email")),
      requires_internal_approval: bool(form.get("requires_internal_approval")),
      candidate_approval_required: bool(form.get("candidate_approval_required")),
      show_bill_rates: bool(form.get("show_bill_rates")),
      show_worker_contact_info: bool(form.get("show_worker_contact_info")),
    })
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      error: error.message.includes("duplicate")
        ? `The slug "${slug}" is already in use.`
        : error.message,
    };
  }

  revalidatePath("/agency/customers");
  return { ok: true, data: data.id };
}

export async function updateCustomer(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  if (!id) return { ok: false, error: "Missing customer." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      legal_name: nz(form.get("legal_name")),
      display_name: nz(form.get("display_name")),
      status: nz(form.get("status")) ?? "prospect",
      billing_email: nz(form.get("billing_email")),
      requires_internal_approval: bool(form.get("requires_internal_approval")),
      candidate_approval_required: bool(form.get("candidate_approval_required")),
      show_bill_rates: bool(form.get("show_bill_rates")),
      show_worker_contact_info: bool(form.get("show_worker_contact_info")),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/agency/customers/${id}`);
  return { ok: true };
}

// =====================================================================
// Sites
// =====================================================================

export async function createSite(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const customerId = nz(form.get("customer_id"));
  const name = nz(form.get("name"));
  if (!customerId || !name) {
    return { ok: false, error: "Customer and site name are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sites").insert({
    customer_id: customerId,
    name,
    site_code: nz(form.get("site_code")),
    address_line1: nz(form.get("address_line1")) ?? "—",
    city: nz(form.get("city")) ?? "—",
    state: nz(form.get("state")) ?? "—",
    postal_code: nz(form.get("postal_code")) ?? "—",
    default_shift: nz(form.get("default_shift")) ?? "day",
    default_hours_per_day: num(form.get("default_hours_per_day")) ?? 10,
    default_days_per_week: num(form.get("default_days_per_week")) ?? 6,
    default_per_diem_rate: num(form.get("default_per_diem_rate")),
    reporting_location: nz(form.get("reporting_location")),
    badging_lead_time_days: num(form.get("badging_lead_time_days")) ?? 3,
    safety_council_required: bool(form.get("safety_council_required")),
    safety_council_name: nz(form.get("safety_council_name")),
    created_by: guard.profile.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/agency/customers/${customerId}`);
  return { ok: true };
}

// =====================================================================
// Portal logins
// =====================================================================

/**
 * Creates the auth account and its app_users row.
 *
 * The auth account needs the Admin API, which is the one place a service-role
 * key is used. The app_users row is written with the caller's own session, so
 * RLS still adjudicates it.
 *
 * A temporary password is generated and returned once rather than emailed:
 * invite mail depends on SMTP being configured, and a rate-limited default
 * sender is a poor thing to hang customer onboarding on. Hand it over
 * directly and have them change it.
 */
export async function createPortalUser(
  form: FormData,
): Promise<Result<{ email: string; password: string }>> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const email = nz(form.get("email"))?.toLowerCase();
  const fullName = nz(form.get("full_name"));
  const userType = nz(form.get("user_type")) ?? "customer";
  const customerId = nz(form.get("customer_id"));
  const role = nz(form.get("role"));

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "A valid email address is required." };
  }
  if (userType === "customer" && (!customerId || !role)) {
    return { ok: false, error: "Customer users need a company and a role." };
  }
  if (userType === "agency" && !role) {
    return { ok: false, error: "Staff users need a role." };
  }

  // 24 bytes of base64url: plenty of entropy, and safe to read aloud or paste.
  const password = randomBytes(18).toString("base64url");

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError || !created.user) {
    return {
      ok: false,
      error: authError?.message.includes("already")
        ? `${email} already has an account.`
        : (authError?.message ?? "Could not create the account."),
    };
  }

  const supabase = await createClient();
  const { error: rowError } = await supabase.from("app_users").insert({
    id: created.user.id,
    email,
    full_name: fullName,
    user_type: userType,
    customer_id: userType === "customer" ? customerId : null,
    customer_role: userType === "customer" ? role : null,
    agency_role: userType === "agency" ? role : null,
    invited_by: guard.profile.id,
    invited_at: new Date().toISOString(),
  });

  if (rowError) {
    // Roll the auth account back: an auth user with no app_users row can sign
    // in but receives no claims, which looks like a broken login rather than a
    // failed invite.
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: `Could not create the profile: ${rowError.message}` };
  }

  if (customerId) revalidatePath(`/agency/customers/${customerId}`);
  return { ok: true, data: { email, password } };
}

export async function setUserActive(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  const active = bool(form.get("is_active"));
  if (!id) return { ok: false, error: "Missing user." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_users")
    .update({ is_active: active })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/agency/customers");
  return { ok: true };
}
