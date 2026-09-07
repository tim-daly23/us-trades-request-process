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

/**
 * Site-level credential requirements live in sites.default_credential_ids,
 * which the request form already uses to pre-check the credential boxes.
 * TWIC is the one that genuinely belongs to the site rather than the job —
 * a terminal either sits behind a TWIC gate or it does not.
 */
async function twicCredentialId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("credentials")
    .select("id")
    .eq("code", "TWIC")
    .is("customer_id", null)
    .maybeSingle();
  return data?.id ?? null;
}

export async function createSite(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const customerId = nz(form.get("customer_id"));
  const name = nz(form.get("name"));
  if (!customerId || !name) {
    return { ok: false, error: "Customer and site name are required." };
  }

  const supabase = await createClient();

  // Schedule, per diem and contacts are deliberately not asked for here: they
  // vary job to job at the same site. They are editable afterwards as optional
  // pre-fill defaults.
  const credentialIds: string[] = [];
  if (bool(form.get("requires_twic"))) {
    const twic = await twicCredentialId(supabase);
    if (twic) credentialIds.push(twic);
  }

  const { error } = await supabase.from("sites").insert({
    customer_id: customerId,
    name,
    address_line1: nz(form.get("address_line1")) ?? "—",
    city: nz(form.get("city")) ?? "—",
    state: nz(form.get("state")) ?? "—",
    postal_code: nz(form.get("postal_code")) ?? "—",
    safety_council_required: bool(form.get("safety_council_required")),
    safety_council_name: nz(form.get("safety_council_name")),
    default_credential_ids: credentialIds,
    created_by: guard.profile.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/agency/customers/${customerId}`);
  return { ok: true };
}

export async function updateSite(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  const customerId = nz(form.get("customer_id"));
  if (!id) return { ok: false, error: "Missing site." };

  const supabase = await createClient();

  // Preserve any other site-level credentials while toggling TWIC.
  const { data: existing } = await supabase
    .from("sites")
    .select("default_credential_ids")
    .eq("id", id)
    .maybeSingle();

  const twic = await twicCredentialId(supabase);
  let credentialIds: string[] = existing?.default_credential_ids ?? [];
  if (twic) {
    credentialIds = credentialIds.filter((c) => c !== twic);
    if (bool(form.get("requires_twic"))) credentialIds.push(twic);
  }

  const { error } = await supabase
    .from("sites")
    .update({
      default_credential_ids: credentialIds,
      name: nz(form.get("name")),
      address_line1: nz(form.get("address_line1")) ?? "—",
      address_line2: nz(form.get("address_line2")),
      city: nz(form.get("city")) ?? "—",
      state: nz(form.get("state")) ?? "—",
      postal_code: nz(form.get("postal_code")) ?? "—",
      default_shift: nz(form.get("default_shift")) ?? "day",
      default_hours_per_day: num(form.get("default_hours_per_day")) ?? 10,
      default_days_per_week: num(form.get("default_days_per_week")) ?? 6,
      default_per_diem_rate: num(form.get("default_per_diem_rate")),
      safety_council_required: bool(form.get("safety_council_required")),
      safety_council_name: nz(form.get("safety_council_name")),
      site_access_notes: nz(form.get("site_access_notes")),
      status: nz(form.get("status")) ?? "active",
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/agency/sites/${id}`);
  if (customerId) revalidatePath(`/agency/customers/${customerId}`);
  return { ok: true };
}

/**
 * Site contacts live in their own table because a site normally has several —
 * a superintendent, a safety lead, someone at the gate. is_primary marks the
 * one shown alongside the site everywhere else.
 */
export async function addSiteContact(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const siteId = nz(form.get("site_id"));
  const customerId = nz(form.get("customer_id"));
  const name = nz(form.get("name"));
  if (!siteId || !customerId || !name) {
    return { ok: false, error: "A contact name is required." };
  }

  const supabase = await createClient();
  const isPrimary = bool(form.get("is_primary"));

  // Only one primary per site: demote the rest first.
  if (isPrimary) {
    await supabase
      .from("site_contacts")
      .update({ is_primary: false })
      .eq("site_id", siteId);
  }

  const { error } = await supabase.from("site_contacts").insert({
    site_id: siteId,
    customer_id: customerId,
    name,
    role: nz(form.get("role")),
    phone: nz(form.get("phone")),
    email: nz(form.get("email")),
    is_primary: isPrimary,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/agency/sites/${siteId}`);
  revalidatePath(`/agency/customers/${customerId}`);
  return { ok: true };
}

export async function updateSiteContact(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  const siteId = nz(form.get("site_id"));
  if (!id || !siteId) return { ok: false, error: "Missing contact." };

  const supabase = await createClient();
  const isPrimary = bool(form.get("is_primary"));
  if (isPrimary) {
    await supabase
      .from("site_contacts")
      .update({ is_primary: false })
      .eq("site_id", siteId);
  }

  const { error } = await supabase
    .from("site_contacts")
    .update({
      name: nz(form.get("name")),
      role: nz(form.get("role")),
      phone: nz(form.get("phone")),
      email: nz(form.get("email")),
      is_primary: isPrimary,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/agency/sites/${siteId}`);
  return { ok: true };
}

export async function deleteSiteContact(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  const siteId = nz(form.get("site_id"));
  if (!id) return { ok: false, error: "Missing contact." };

  const supabase = await createClient();
  const { error } = await supabase.from("site_contacts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (siteId) revalidatePath(`/agency/sites/${siteId}`);
  return { ok: true };
}

// =====================================================================
// Portal logins
// =====================================================================

/** The Admin API has no lookup-by-email, so page through until it turns up. */
async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<{ id: string } | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) return null;
    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (hit) return { id: hit.id };
    if (data.users.length < 200) return null;
  }
  return null;
}

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

  const supabase = await createClient();
  let authUserId = created?.user?.id ?? null;

  if (authError || !authUserId) {
    const alreadyExists =
      authError?.message.toLowerCase().includes("already") ||
      authError?.status === 422;
    if (!alreadyExists) {
      return {
        ok: false,
        error: authError?.message ?? "Could not create the account.",
      };
    }

    // An auth account can outlive its profile — deleting a customer cascades
    // the app_users row away, and the auth record is not covered by any
    // foreign key. That leaves an address that cannot be created and does not
    // appear in any list. Adopt it: give it a fresh password and a new
    // profile, rather than making someone clean it up in the dashboard.
    const existing = await findAuthUserByEmail(admin, email);
    if (!existing) {
      return {
        ok: false,
        error: `${email} is already registered, but the account could not be found to reuse.`,
      };
    }

    const { data: profile } = await supabase
      .from("app_users")
      .select("id")
      .eq("id", existing.id)
      .maybeSingle();

    if (profile) {
      return { ok: false, error: `${email} already has a login.` };
    }

    const { error: pwError } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (pwError) return { ok: false, error: pwError.message };

    authUserId = existing.id;
  }
  const { error: rowError } = await supabase.from("app_users").insert({
    id: authUserId,
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
    await admin.auth.admin.deleteUser(authUserId);
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

/**
 * Delete a customer and everything under it.
 *
 * Cascades take their sites, requisitions, lines, placements and app_users
 * rows. Auth accounts are not covered by any foreign key, so they are removed
 * afterwards — the tenant row goes first, because an orphaned auth account is
 * harmless (it authenticates but receives no claims) whereas deleting logins
 * for a customer whose data survived would not be.
 *
 * Requires the slug typed back, since there is no undo.
 */
export async function deleteCustomer(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  const typed = nz(form.get("confirm_slug"));
  if (!id) return { ok: false, error: "Missing customer." };

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("slug, display_name")
    .eq("id", id)
    .maybeSingle();
  if (!customer) return { ok: false, error: "Customer not found." };

  if (typed?.toLowerCase() !== customer.slug.toLowerCase()) {
    return {
      ok: false,
      error: `Type the slug "${customer.slug}" exactly to confirm deletion.`,
    };
  }

  // Collect the auth accounts before the cascade removes the rows naming them.
  const { data: users } = await supabase
    .from("app_users")
    .select("id")
    .eq("customer_id", id);

  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (users?.length) {
    try {
      const admin = createAdminClient();
      for (const u of users) {
        await admin.auth.admin.deleteUser(u.id);
      }
    } catch {
      // The tenant is gone either way. A leftover auth account can still sign
      // in but has no app_users row, so the hook strips its claims and it sees
      // nothing — safe, just untidy. Creating a login for that address later
      // adopts the orphan rather than failing.
    }
  }

  revalidatePath("/agency/customers");
  return { ok: true };
}

/**
 * Delete a portal login and its auth account.
 *
 * app_users is referenced by requisitions.created_by and friends with no ON
 * DELETE clause, so a user who has raised anything cannot be removed — the
 * foreign key refuses, and the message says to disable them instead. That is
 * the correct outcome: deleting them would erase who asked for the work.
 */
export async function deletePortalUser(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  if (!id) return { ok: false, error: "Missing user." };
  if (id === guard.profile.id) {
    return { ok: false, error: "You cannot delete your own account." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("app_users").delete().eq("id", id);

  if (error) {
    const isFk =
      error.code === "23503" || error.message.toLowerCase().includes("foreign key");
    return {
      ok: false,
      error: isFk
        ? "This user has raised or approved requests, so their record cannot be deleted without erasing who did that. Disable them instead."
        : error.message,
    };
  }

  try {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(id);
  } catch {
    // Profile is gone, so the hook strips this account's claims and it sees
    // nothing even if it can still authenticate. Untidy, not unsafe.
  }

  revalidatePath("/agency/customers");
  return { ok: true };
}

/** Issue a new password for an existing login and return it once. */
export async function resetPortalUserPassword(
  form: FormData,
): Promise<Result<{ email: string; password: string }>> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  if (!id) return { ok: false, error: "Missing user." };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("app_users")
    .select("email")
    .eq("id", id)
    .maybeSingle();
  if (!target) return { ok: false, error: "User not found." };

  const password = randomBytes(18).toString("base64url");

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/agency/customers");
  return { ok: true, data: { email: target.email, password } };
}
