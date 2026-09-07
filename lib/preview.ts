import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export const PREVIEW_COOKIE = "preview_customer_id";

export type PortalScope = {
  /** The tenant whose data the portal screens should show, or null for none. */
  customerId: string | null;
  displayName: string | null;
  /** True when agency staff are looking at a customer's portal. */
  isPreview: boolean;
  /** The previewed customer's own visibility flags, so the preview honours them. */
  showBillRates: boolean;
  showWorkerContactInfo: boolean;
  candidateApprovalRequired: boolean;
};

/**
 * Which tenant the customer-facing screens should render.
 *
 * A customer user is always scoped to their own company by RLS, and this adds
 * nothing for them. Agency staff can read every tenant, so without an explicit
 * choice the portal would show all customers at once — which is not what any
 * customer sees. Preview mode picks one and filters to it.
 *
 * This is a fidelity aid, not a security boundary: staff could read those rows
 * anyway. What it reproduces is the *shape* of a customer's view.
 */
export async function getPortalScope(): Promise<PortalScope> {
  const profile = await getProfile();
  const supabase = await createClient();

  const empty: PortalScope = {
    customerId: null,
    displayName: null,
    isPreview: false,
    showBillRates: true,
    showWorkerContactInfo: false,
    candidateApprovalRequired: true,
  };

  if (!profile) return empty;

  if (profile.user_type === "customer") {
    // RLS already restricts them; read the flags so pages can honour them.
    const { data } = await supabase
      .from("customers")
      .select(
        "id, display_name, show_bill_rates, show_worker_contact_info, candidate_approval_required",
      )
      .maybeSingle();
    return {
      customerId: profile.customer_id,
      displayName: data?.display_name ?? null,
      isPreview: false,
      showBillRates: data?.show_bill_rates ?? true,
      showWorkerContactInfo: data?.show_worker_contact_info ?? false,
      candidateApprovalRequired: data?.candidate_approval_required ?? true,
    };
  }

  const chosen = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (!chosen) return empty;

  const { data } = await supabase
    .from("customers")
    .select(
      "id, display_name, show_bill_rates, show_worker_contact_info, candidate_approval_required",
    )
    .eq("id", chosen)
    .maybeSingle();

  if (!data) return empty;

  return {
    customerId: data.id,
    displayName: data.display_name,
    isPreview: true,
    showBillRates: data.show_bill_rates,
    showWorkerContactInfo: data.show_worker_contact_info,
    candidateApprovalRequired: data.candidate_approval_required,
  };
}

/** Every customer, for the preview picker. */
export async function listCustomersForPreview() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, display_name")
    .is("deleted_at", null)
    .order("display_name");
  return data ?? [];
}
