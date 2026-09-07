import Link from "next/link";
import { requireAgency } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRole } from "@/lib/supabase/admin";
import { NewCustomerForm } from "@/components/agency/new-customer-form";

type Row = {
  id: string;
  slug: string;
  display_name: string;
  legal_name: string;
  status: string;
  billing_email: string | null;
};

const TONE: Record<string, string> = {
  active: "approved",
  prospect: "pending",
  on_hold: "pending",
  inactive: "inactive",
};

export default async function CustomersPage() {
  await requireAgency();
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, slug, display_name, legal_name, status, billing_email")
    .is("deleted_at", null)
    .order("display_name")
    .returns<Row[]>();

  // Count users and sites per tenant so the list says whether a portal is
  // actually usable yet, not just that a record exists.
  const [{ data: users }, { data: sites }] = await Promise.all([
    supabase.from("app_users").select("customer_id").eq("user_type", "customer"),
    supabase.from("sites").select("customer_id").is("deleted_at", null),
  ]);

  const tally = (rows: { customer_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (r.customer_id) m.set(r.customer_id, (m.get(r.customer_id) ?? 0) + 1);
    }
    return m;
  };
  const userCount = tally(users);
  const siteCount = tally(sites);

  return (
    <>
      {!hasServiceRole() && (
        <div className="panel">
          <div className="notice-warn">
            <strong>SUPABASE_SERVICE_ROLE_KEY is not set.</strong> Customers and
            sites can be created, but portal logins cannot — creating an auth
            account needs the Admin API. Add the key to{" "}
            <code>.env.local</code> and restart the dev server.
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Customers</h2>
            <div className="sub">
              Each customer gets their own portal, request numbering and site
              list.
            </div>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th style={{ width: 120 }}>Slug</th>
              <th style={{ width: 90 }}>Sites</th>
              <th style={{ width: 90 }}>Logins</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {!customers?.length ? (
              <tr className="empty-row">
                <td colSpan={6}>No customers yet — add the first one below.</td>
              </tr>
            ) : (
              customers.map((c) => {
                const sites = siteCount.get(c.id) ?? 0;
                const logins = userCount.get(c.id) ?? 0;
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.display_name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--steel-dim)" }}>
                        {c.legal_name}
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: 12.5 }}>
                      {c.slug}
                    </td>
                    <td className="mono">
                      <span style={{ color: sites ? undefined : "var(--red)" }}>
                        {sites}
                      </span>
                    </td>
                    <td className="mono">
                      <span style={{ color: logins ? undefined : "var(--red)" }}>
                        {logins}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${TONE[c.status] ?? "inactive"}`}>
                        {c.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/agency/customers/${c.id}`}
                        className="action-btn"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="hint">
          A customer with no sites cannot raise a request, and one with no
          logins cannot sign in. Both counts show red until they are set up.
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Add a customer</h2>
            <div className="sub">
              The slug becomes their request prefix — ACME-2026-0001 — and their
              subdomain. It cannot be changed afterwards.
            </div>
          </div>
        </div>
        <NewCustomerForm />
      </div>
    </>
  );
}
