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
