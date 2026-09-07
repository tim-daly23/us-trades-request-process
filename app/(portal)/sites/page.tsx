import { createClient } from "@/lib/supabase/server";
import { getPortalScope } from "@/lib/preview";
import { getProfile } from "@/lib/auth";
import { ActionForm } from "@/components/agency/action-form";
import {
  createCustomerSite,
  updateCustomerSite,
  addCustomerSiteContact,
} from "./actions";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  is_primary: boolean;
};

type Site = {
  id: string;
  name: string;
  address_line1: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  status: string;
  safety_council_required: boolean | null;
  safety_council_name: string | null;
  default_credential_ids: string[] | null;
  contacts: Contact[] | null;
};

export default async function CustomerSitesPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const scope = await getPortalScope();

  // Agency staff can read every tenant, so the portal screens filter to the
  // previewed customer. For a customer user this is their own id and the
  // filter is redundant with RLS — harmless, and keeps one code path.
  const only = <T,>(q: T): T =>
    scope.customerId
      ? ((q as { eq: (c: string, v: string) => T }).eq(
          "customer_id",
          scope.customerId,
        ) as T)
      : q;

  const [{ data: sites }, { data: customer }, { data: twic }] = await Promise.all([
    only(
      supabase
        .from("sites")
        .select("*, contacts:site_contacts(id, name, role, phone, is_primary)"),
    )
      .is("deleted_at", null)
      .order("name")
      .returns<Site[]>(),
    only(supabase.from("customers").select("allow_requester_site_create, id"))
      .maybeSingle(),
    supabase
      .from("credentials")
      .select("id")
      .eq("code", "TWIC")
      .is("customer_id", null)
      .maybeSingle(),
  ]);

  const role = profile?.customer_role;
  const canManage =
    !scope.isPreview &&
    (role === "customer_admin" ||
    role === "approver" ||
      (role === "requester" && customer?.allow_requester_site_create === true));

  const rows = sites ?? [];

  return (
    <>
      <div className="panel-head" style={{ marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 24 }}>Your sites</h2>
          <div className="sub">
            Where your crews report. Every request points at one of these.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Sites</h2>
            <div className="sub">{rows.length} on file</div>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Site</th>
              <th style={{ width: 230 }}>Address</th>
              <th style={{ width: 200 }}>Site contact</th>
              <th style={{ width: 110 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={4}>
                  No sites yet — a request has to point at one.
                </td>
              </tr>
            ) : (
              rows.map((s) => {
                const contacts = s.contacts ?? [];
                const c = contacts.find((x) => x.is_primary) ?? contacts[0];
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{s.name}</div>
                      <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                        {twic?.id &&
                          (s.default_credential_ids ?? []).includes(twic.id) && (
                            <span className="badge submitted">TWIC</span>
                          )}
                        {s.safety_council_required && (
                          <span className="badge pending">Safety council</span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: "var(--steel)" }}>
                      {s.address_line1}
                      <div style={{ fontSize: 12, color: "var(--steel-dim)" }}>
                        {s.city}, {s.state} {s.postal_code}
                      </div>
                    </td>
                    <td>
                      {c ? (
                        <>
                          <div style={{ fontSize: 12.5 }}>
                            {c.name}
                            {c.role && (
                              <span style={{ color: "var(--steel-dim)" }}>
                                {" "}
                                · {c.role}
                              </span>
                            )}
                          </div>
                          <div className="mono" style={{ fontSize: 11.5, color: "var(--steel)" }}>
                            {c.phone ?? "—"}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: "var(--steel-dim)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${s.status === "active" ? "approved" : "inactive"}`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <>
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Add a site</h2>
                <div className="sub">
                  US Trades sets the badging and access requirements after you
                  add it.
                </div>
              </div>
            </div>

            <ActionForm
              action={createCustomerSite}
              submitLabel="Add site"
              resetOnSuccess
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: "0 14px",
                }}
              >
                <label className="field">
                  <span>
                    Site name <span className="req-star">*</span>
                  </span>
                  <input name="name" required placeholder="Baytown Olefins Plant" />
                </label>
                <label className="field">
                  <span>Address</span>
                  <input name="address_line1" placeholder="5000 Bayway Dr" />
                </label>
                <label className="field">
                  <span>City</span>
                  <input name="city" placeholder="Baytown" />
                </label>
                <label className="field">
                  <span>State</span>
                  <input name="state" maxLength={2} placeholder="TX" />
                </label>
                <label className="field">
                  <span>ZIP</span>
                  <input name="postal_code" placeholder="77520" />
                </label>
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                  fontSize: 12.5,
                }}
              >
                <input
                  type="checkbox"
                  name="safety_council_required"
                  style={{ width: 16, height: 16 }}
                />
                <span>Safety council training required at this site</span>
              </label>
            </ActionForm>
          </div>

          {rows.length > 0 && (
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h2>Edit a site</h2>
                  <div className="sub">
                    Change an address, add a contact, or retire a site you no
                    longer use.
                  </div>
                </div>
              </div>

              {rows.map((s) => (
                <details key={s.id} style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 500 }}>
                    {s.name}
                  </summary>

                  <div style={{ marginTop: 12 }}>
                    <ActionForm action={updateCustomerSite} submitLabel="Save site" submitClass="action-btn">
                      <input type="hidden" name="id" value={s.id} />
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                          gap: "0 14px",
                        }}
                      >
                        <label className="field">
                          <span>Site name</span>
                          <input name="name" defaultValue={s.name} />
                        </label>
                        <label className="field">
                          <span>Address</span>
                          <input name="address_line1" defaultValue={s.address_line1 ?? ""} />
                        </label>
                        <label className="field">
                          <span>City</span>
                          <input name="city" defaultValue={s.city} />
                        </label>
                        <label className="field">
                          <span>State</span>
                          <input name="state" maxLength={2} defaultValue={s.state} />
                        </label>
                        <label className="field">
                          <span>ZIP</span>
                          <input name="postal_code" defaultValue={s.postal_code ?? ""} />
                        </label>
                        <label className="field">
                          <span>Status</span>
                          <select name="status" defaultValue={s.status}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </label>
                      </div>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 12,
                          fontSize: 12.5,
                        }}
                      >
                        <input
                          type="checkbox"
                          name="safety_council_required"
                          defaultChecked={s.safety_council_required ?? false}
                          style={{ width: 16, height: 16 }}
                        />
                        <span>Safety council training required</span>
                      </label>
                    </ActionForm>

                    <div style={{ marginTop: 14 }}>
                      <h3 style={{ fontSize: 15, marginBottom: 8 }}>Add a contact</h3>
                      <ActionForm
                        action={addCustomerSiteContact}
                        submitLabel="Add contact"
                        submitClass="action-btn"
                        resetOnSuccess
                      >
                        <input type="hidden" name="site_id" value={s.id} />
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                            gap: "0 14px",
                          }}
                        >
                          <label className="field">
                            <span>
                              Name <span className="req-star">*</span>
                            </span>
                            <input name="name" required />
                          </label>
                          <label className="field">
                            <span>Role</span>
                            <input name="role" placeholder="Superintendent" />
                          </label>
                          <label className="field">
                            <span>Phone</span>
                            <input name="phone" type="tel" />
                          </label>
                        </div>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 10,
                            fontSize: 12.5,
                          }}
                        >
                          <input
                            type="checkbox"
                            name="is_primary"
                            defaultChecked={(s.contacts ?? []).length === 0}
                            style={{ width: 16, height: 16 }}
                          />
                          <span>Primary contact</span>
                        </label>
                      </ActionForm>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="panel">
          <div className="notice-warn">
            {scope.isPreview
              ? "Staff preview is read-only. Manage this customer's sites from the console."
              : "Your account keeps its site list centrally. Ask an admin at your company, or your US Trades rep, to add or change a site."}
          </div>
        </div>
      )}
    </>
  );
}
