import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RequestForm } from "@/components/request-form";
import { getProfile } from "@/lib/auth";
import type {
  CraftOption,
  CustomerOption,
  CredentialOption,
  LevelOption,
  SiteOption,
} from "@/lib/requisition-types";

type CustomerCredentialRow = {
  credential_id: string;
  is_enabled: boolean;
  is_mandatory: boolean;
  default_checked: boolean;
  label_override: string | null;
  sort_order: number;
  credential: {
    id: string;
    name: string;
    short_label: string | null;
    requires_state: boolean;
    is_active: boolean;
  } | null;
};

export default async function NewRequisitionPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const isAgency = profile?.user_type === "agency";

  // RLS scopes sites to the caller's tenant, and crafts/levels are global
  // reference data every signed-in user can read.
  const [{ data: sites }, { data: crafts }, { data: levels }, { data: configured }] =
    await Promise.all([
      supabase
        .from("sites")
        .select(
          `id, customer_id, name, city, state, default_shift, default_hours_per_day,
           default_days_per_week, default_per_diem_rate,
           safety_council_required, safety_council_name,
           default_credential_ids`,
        )
        .eq("status", "active")
        .order("name")
        .returns<SiteOption[]>(),
      supabase
        .from("crafts")
        .select("id, name, category")
        .eq("is_active", true)
        .order("sort_order")
        .returns<CraftOption[]>(),
      supabase
        .from("levels")
        .select("id, name, rank")
        .eq("is_active", true)
        .order("rank")
        .returns<LevelOption[]>(),
      supabase
        .from("customer_credentials")
        .select(
          `credential_id, is_enabled, is_mandatory, default_checked,
           label_override, sort_order,
           credential:credentials(id, name, short_label, requires_state, is_active)`,
        )
        .eq("is_enabled", true)
        .order("sort_order")
        .returns<CustomerCredentialRow[]>(),
    ]);

  // Agency staff can raise a request for any customer; RLS returns every
  // tenant's sites to them, so the form filters by the chosen customer.
  const { data: customers } = isAgency
    ? await supabase
        .from("customers")
        .select("id, display_name")
        .is("deleted_at", null)
        .neq("status", "inactive")
        .order("display_name")
        .returns<CustomerOption[]>()
    : { data: null };

  let credentials: CredentialOption[] = (configured ?? [])
    .filter((row) => row.credential?.is_active)
    .map((row) => ({
      id: row.credential_id,
      label:
        row.label_override ??
        row.credential!.short_label ??
        row.credential!.name,
      mandatory: row.is_mandatory,
      defaultChecked: row.default_checked,
      requiresState: row.credential!.requires_state,
    }));

  // A customer who has not been configured yet gets the global catalogue, so
  // the form is usable from day one rather than showing an empty section.
  if (credentials.length === 0) {
    const { data: global } = await supabase
      .from("credentials")
      .select("id, name, short_label, requires_state")
      .is("customer_id", null)
      .eq("is_active", true)
      .order("sort_order");

    credentials = (global ?? []).map((c) => ({
      id: c.id,
      label: c.short_label ?? c.name,
      mandatory: false,
      defaultChecked: false,
      requiresState: c.requires_state,
    }));
  }

  if (!sites?.length) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface p-12 text-center">
        <p className="font-medium">No sites set up yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          A request has to point at a site. Ask US Trades to add your locations,
          and they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/requests"
          className="text-sm text-muted transition hover:text-brand"
        >
          ← All requisitions
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          New manpower request
        </h1>
        <p className="mt-1 text-sm text-muted">
          Choosing a site fills in its usual schedule and standing credential
          requirements. Change anything that differs for this job.
        </p>
      </div>

      <RequestForm
        customers={customers ?? []}
        sites={sites}
        crafts={crafts ?? []}
        levels={levels ?? []}
        credentials={credentials}
      />
    </div>
  );
}
