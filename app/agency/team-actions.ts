"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAgencyAdmin } from "@/lib/auth";

type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

const nz = (v: FormDataEntryValue | null): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

const AGENCY_ROLES = [
  "super_admin",
  "ops_manager",
  "recruiter",
  "compliance",
  "finance",
  "viewer",
] as const;

/**
 * Replace a staff member's customer list with exactly what was ticked.
 *
 * Sent as the whole set rather than as individual add/remove calls: the form
 * shows every customer with a checkbox, so the submission already is the
 * intended end state, and diffing it here means an unticked box can never be
 * silently dropped on the way.
 */
export async function setStaffCustomers(form: FormData): Promise<Result> {
  const guard = await assertAgencyAdmin();
  if (!guard.ok) return guard;

  const userId = nz(form.get("user_id"));
  if (!userId) return { ok: false, error: "Missing team member." };

  const wanted = new Set(
    form.getAll("customer_ids").filter((v): v is string => typeof v === "string"),
  );

  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("app_users")
    .select("id, user_type, agency_role")
    .eq("id", userId)
    .maybeSingle();

  if (!staff || staff.user_type !== "agency") {
    return { ok: false, error: "That is not a US Trades staff account." };
  }

  const { data: current, error: readError } = await supabase
    .from("agency_customer_assignments")
    .select("customer_id")
    .eq("app_user_id", userId);

  if (readError) return { ok: false, error: readError.message };

  const have = new Set((current ?? []).map((r) => r.customer_id as string));
  const toAdd = [...wanted].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !wanted.has(id));

  if (toRemove.length) {
    const { error } = await supabase
      .from("agency_customer_assignments")
      .delete()
      .eq("app_user_id", userId)
      .in("customer_id", toRemove);
    if (error) return { ok: false, error: error.message };
  }

  if (toAdd.length) {
    const { error } = await supabase.from("agency_customer_assignments").insert(
      toAdd.map((customerId) => ({
        app_user_id: userId,
        customer_id: customerId,
        assigned_by: guard.profile.id,
      })),
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/agency/team");
  return { ok: true };
}

/**
 * Change what a team member is.
 *
 * The role lives in the access token, so this does not change what they can
 * reach until their next sign-in. The screen says so; there is no way to
 * force a token to be reissued from here.
 */
export async function setStaffRole(form: FormData): Promise<Result> {
  const guard = await assertAgencyAdmin();
  if (!guard.ok) return guard;

  const userId = nz(form.get("user_id"));
  const role = nz(form.get("agency_role"));
  if (!userId || !role) return { ok: false, error: "Missing team member or role." };
  if (!(AGENCY_ROLES as readonly string[]).includes(role)) {
    return { ok: false, error: "Unknown role." };
  }

  // Demoting yourself out of super_admin locks you out of this screen, and if
  // you are the only one it locks everybody out permanently — the policy that
  // guards this table only answers to super_admin.
  if (userId === guard.profile.id && role !== "super_admin") {
    return {
      ok: false,
      error:
        "You cannot change your own role. Ask another super admin to do it.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_users")
    .update({ agency_role: role })
    .eq("id", userId)
    .eq("user_type", "agency");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/agency/team");
  return { ok: true };
}

/** Switch a staff login off without deleting it, or back on. */
export async function setStaffActive(form: FormData): Promise<Result> {
  const guard = await assertAgencyAdmin();
  if (!guard.ok) return guard;

  const userId = nz(form.get("user_id"));
  const active = form.get("is_active") === "true";
  if (!userId) return { ok: false, error: "Missing team member." };

  if (userId === guard.profile.id && !active) {
    return { ok: false, error: "You cannot deactivate your own account." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_users")
    .update({ is_active: active })
    .eq("id", userId)
    .eq("user_type", "agency");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/agency/team");
  return { ok: true };
}
