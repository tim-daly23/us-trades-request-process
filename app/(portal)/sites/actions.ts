"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

const nz = (v: FormDataEntryValue | null): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";

/**
 * Whether this user may add or change their company's sites.
 *
 * Admins and approvers always can. Requesters can only if the customer has
 * allow_requester_site_create switched on — some accounts want their site list
 * controlled centrally rather than growing every time someone raises a request.
 */
async function canManageSites(): Promise<
  { ok: true; customerId: string } | { ok: false; error: string }
> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.user_type !== "customer" || !profile.customer_id) {
    return { ok: false, error: "Use the agency console to manage sites." };
  }

  if (profile.customer_role === "viewer") {
    return { ok: false, error: "Viewers cannot change sites." };
  }

  if (profile.customer_role === "requester") {
    const supabase = await createClient();
    const { data: customer } = await supabase
      .from("customers")
      .select("allow_requester_site_create")
      .eq("id", profile.customer_id)
      .maybeSingle();
    if (!customer?.allow_requester_site_create) {
      return {
        ok: false,
        error:
          "Your account keeps its site list centrally. Ask an admin at your company, or your US Trades rep, to add it.",
      };
    }
  }

  return { ok: true, customerId: profile.customer_id };
}

export async function createCustomerSite(form: FormData): Promise<Result> {
  const guard = await canManageSites();
  if (!guard.ok) return guard;

  const name = nz(form.get("name"));
  if (!name) return { ok: false, error: "A site name is required." };

  const supabase = await createClient();
  const profile = await getProfile();

  // customer_id comes from the profile, never the form — RLS would reject a
  // foreign tenant anyway, but it should not be proposable.
  const { error } = await supabase.from("sites").insert({
    customer_id: guard.customerId,
    name,
    address_line1: nz(form.get("address_line1")) ?? "—",
    city: nz(form.get("city")) ?? "—",
    state: nz(form.get("state")) ?? "—",
    postal_code: nz(form.get("postal_code")) ?? "—",
    safety_council_required: bool(form.get("safety_council_required")),
    created_by: profile?.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/sites");
  return { ok: true };
}

export async function updateCustomerSite(form: FormData): Promise<Result> {
  const guard = await canManageSites();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  if (!id) return { ok: false, error: "Missing site." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sites")
    .update({
      name: nz(form.get("name")),
      address_line1: nz(form.get("address_line1")) ?? "—",
      city: nz(form.get("city")) ?? "—",
      state: nz(form.get("state")) ?? "—",
      postal_code: nz(form.get("postal_code")) ?? "—",
      safety_council_required: bool(form.get("safety_council_required")),
      status: nz(form.get("status")) ?? "active",
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/sites");
  return { ok: true };
}

export async function addCustomerSiteContact(form: FormData): Promise<Result> {
  const guard = await canManageSites();
  if (!guard.ok) return guard;

  const siteId = nz(form.get("site_id"));
  const name = nz(form.get("name"));
  if (!siteId || !name) return { ok: false, error: "A contact name is required." };

  const supabase = await createClient();
  if (bool(form.get("is_primary"))) {
    await supabase
      .from("site_contacts")
      .update({ is_primary: false })
      .eq("site_id", siteId);
  }

  const { error } = await supabase.from("site_contacts").insert({
    site_id: siteId,
    customer_id: guard.customerId,
    name,
    role: nz(form.get("role")),
    phone: nz(form.get("phone")),
    email: nz(form.get("email")),
    is_primary: bool(form.get("is_primary")),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/sites");
  return { ok: true };
}
