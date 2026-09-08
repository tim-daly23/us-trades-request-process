import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  user_type: "agency" | "customer";
  customer_id: string | null;
  agency_role: string | null;
  customer_role: string | null;
};

/** The signed-in user's app_users row, or null if there isn't one. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("app_users")
    .select(
      "id, email, full_name, user_type, customer_id, agency_role, customer_role",
    )
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile) ?? null;
}

/**
 * Gate for every agency screen and every agency server action.
 *
 * RLS is the real enforcement — an agency-only policy rejects a customer's JWT
 * whatever the UI does. This exists so a customer who guesses a /agency URL
 * gets sent home instead of an empty page, and so actions fail early with a
 * clear message rather than a policy violation.
 */
export async function requireAgency(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.user_type !== "agency") redirect("/");
  return profile;
}

/** Same check for server actions, which must not redirect mid-mutation. */
export async function assertAgency(): Promise<
  { ok: true; profile: Profile } | { ok: false; error: string }
> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.user_type !== "agency") {
    return { ok: false, error: "US Trades staff only." };
  }
  return { ok: true, profile };
}

/**
 * The unrestricted tier: sees every customer, creates staff, hands out access.
 *
 * Mirrors is_agency_admin() in the database, which is where it is actually
 * enforced. Read the role from the profile row rather than the JWT so a
 * promotion takes effect on the next page load instead of the next sign-in —
 * the policies still want the claim, so the sign-in is what makes it real, but
 * this way the screen and the database agree about who is being told no.
 */
export function isAgencyAdmin(profile: Profile | null): boolean {
  return profile?.user_type === "agency" && profile.agency_role === "super_admin";
}

/** Gate for screens only an admin may open. */
export async function requireAgencyAdmin(): Promise<Profile> {
  const profile = await requireAgency();
  if (!isAgencyAdmin(profile)) redirect("/agency");
  return profile;
}

/** Same check for server actions. */
export async function assertAgencyAdmin(): Promise<
  { ok: true; profile: Profile } | { ok: false; error: string }
> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;
  if (!isAgencyAdmin(guard.profile)) {
    return {
      ok: false,
      error: "Only a super admin can manage the team.",
    };
  }
  return guard;
}
