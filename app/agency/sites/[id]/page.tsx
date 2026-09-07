import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  updateSite,
  addSiteContact,
  updateSiteContact,
  deleteSiteContact,
} from "@/app/agency/actions";
import { ActionForm } from "@/components/agency/action-form";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
};

export default async function SiteDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAgency();
  const supabase = await createClient();

  const { data: site } = await supabase
    .from("sites")
    .select("*, customer:customers(id, display_name)")
    .eq("id", id)
    .maybeSingle();
  if (!site) notFound();

  const customer = Array.isArray(site.customer) ? site.customer[0] : site.customer;

  const { data: contacts } = await supabase
    .from("site_contacts")
    .select("id, name, role, phone, email, is_primary")
    .eq("site_id", id)
    .order("is_primary", { ascending: false })
    .order("name")
    .returns<Contact[]>();

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <Link
          href={`/agency/customers/${customer?.id ?? ""}`}
          style={{
            fontSize: 12.5,
            color: "var(--steel)",
            textDecoration: "none",
            borderBottom: "1px dotted var(--steel)",
          }}
        >
          ← {customer?.display_name ?? "Customer"}
        </Link>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>{site.name}</h2>
            <div className="sub">
              {customer?.display_name}
              {site.site_code ? ` · ${site.site_code}` : ""}
            </div>
          </div>
          <span className={`badge ${site.status === "active" ? "approved" : "inactive"}`}>
            {site.status}
          </span>
        </div>

        <ActionForm action={updateSite} submitLabel="Save site">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="customer_id" value={customer?.id ?? ""} />

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
              <input name="name" required defaultValue={site.name} />
            </label>
            <label className="field">
              <span>Site code</span>
              <input name="site_code" defaultValue={site.site_code ?? ""} />
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={site.status}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="field">
              <span>Address</span>
              <input name="address_line1" defaultValue={site.address_line1 ?? ""} />
            </label>
            <label className="field">
              <span>Address line 2</span>
              <input name="address_line2" defaultValue={site.address_line2 ?? ""} />
            </label>
            <label className="field">
              <span>City</span>
              <input name="city" defaultValue={site.city ?? ""} />
            </label>
            <label className="field">
              <span>State</span>
              <input name="state" maxLength={2} defaultValue={site.state ?? ""} />
            </label>
            <label className="field">
              <span>ZIP</span>
              <input name="postal_code" defaultValue={site.postal_code ?? ""} />
            </label>
            <label className="field">
              <span>Shift</span>
              <select name="default_shift" defaultValue={site.default_shift ?? "day"}>
                <option value="day">Day</option>
                <option value="night">Night</option>
                <option value="swing">Swing</option>
                <option value="rotating">Rotating</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="field">
              <span>Days / week</span>
              <input
                name="default_days_per_week"
                type="number"
                min="1"
                max="7"
                defaultValue={site.default_days_per_week ?? 6}
              />
            </label>
            <label className="field">
              <span>Hours / day</span>
              <input
                name="default_hours_per_day"
                type="number"
                min="1"
                max="24"
                step="0.5"
                defaultValue={
                  site.default_hours_per_day ? Number(site.default_hours_per_day) : 10
                }
              />
            </label>
            <label className="field">
              <span>Per diem</span>
              <input
                name="default_per_diem_rate"
                type="number"
                min="0"
                step="0.01"
                defaultValue={
                  site.default_per_diem_rate ? Number(site.default_per_diem_rate) : ""
                }
              />
            </label>
            <label className="field">
              <span>Safety council</span>
              <input
                name="safety_council_name"
                defaultValue={site.safety_council_name ?? ""}
                placeholder="Houston Area Safety Council"
              />
            </label>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 13,
              fontSize: 12.5,
            }}
          >
            <input
              type="checkbox"
              name="safety_council_required"
              defaultChecked={site.safety_council_required ?? false}
              style={{ width: 16, height: 16 }}
            />
            <span>Safety council training required at this site</span>
          </label>

          <label className="field">
            <span>Site access notes</span>
            <textarea
              name="site_access_notes"
              rows={2}
              defaultValue={site.site_access_notes ?? ""}
              placeholder="Gate, parking, escort requirements, anything unusual."
            />
          </label>

          <div className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
            These defaults pre-fill the customer&apos;s request form. Changing
            them affects new requests, not ones already raised.
          </div>
        </ActionForm>
      </div>

      {/* -------------------------------------------------- contacts */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Site contacts</h2>
            <div className="sub">
              Who to call at this site. The primary contact is shown wherever
              the site appears.
            </div>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 150 }}>Role</th>
              <th style={{ width: 150 }}>Phone</th>
              <th style={{ width: 200 }}>Email</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {!contacts?.length ? (
              <tr className="empty-row">
                <td colSpan={5}>No contacts yet.</td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>
                    {c.name}
                    {c.is_primary && (
                      <span className="badge approved" style={{ marginLeft: 6 }}>
                        Primary
                      </span>
                    )}
                  </td>
                  <td style={{ color: "var(--steel)" }}>{c.role ?? "—"}</td>
                  <td className="mono" style={{ fontSize: 12.5 }}>
                    {c.phone ?? "—"}
                  </td>
                  <td style={{ fontSize: 12.5, color: "var(--steel)" }}>
                    {c.email ?? "—"}
                  </td>
                  <td>
                    <ActionForm
                      action={deleteSiteContact}
                      submitLabel="Remove"
                      submitClass="action-btn"
                      inline
                      confirm={`Remove ${c.name}?`}
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="site_id" value={id} />
                    </ActionForm>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!!contacts?.length && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--steel)" }}>
              Edit an existing contact
            </summary>
            <div style={{ marginTop: 12 }}>
              {contacts.map((c) => (
                <div
                  key={c.id}
                  style={{
                    borderTop: "1px solid var(--line)",
                    paddingTop: 12,
                    marginBottom: 4,
                  }}
                >
                  <ActionForm
                    action={updateSiteContact}
                    submitLabel="Save"
                    submitClass="action-btn"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="site_id" value={id} />
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: "0 14px",
                      }}
                    >
                      <label className="field">
                        <span>Name</span>
                        <input name="name" defaultValue={c.name} />
                      </label>
                      <label className="field">
                        <span>Role</span>
                        <input name="role" defaultValue={c.role ?? ""} />
                      </label>
                      <label className="field">
                        <span>Phone</span>
                        <input name="phone" type="tel" defaultValue={c.phone ?? ""} />
                      </label>
                      <label className="field">
                        <span>Email</span>
                        <input name="email" type="email" defaultValue={c.email ?? ""} />
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
                        defaultChecked={c.is_primary}
                        style={{ width: 16, height: 16 }}
                      />
                      <span>Primary contact for this site</span>
                    </label>
                  </ActionForm>
                </div>
              ))}
            </div>
          </details>
        )}

        <div style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>Add a contact</h3>
          <ActionForm action={addSiteContact} submitLabel="Add contact" resetOnSuccess>
            <input type="hidden" name="site_id" value={id} />
            <input type="hidden" name="customer_id" value={customer?.id ?? ""} />
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
                <input name="name" required placeholder="Dale Fuentes" />
              </label>
              <label className="field">
                <span>Role</span>
                <input name="role" placeholder="Superintendent" />
              </label>
              <label className="field">
                <span>Phone</span>
                <input name="phone" type="tel" placeholder="(409) 555-0142" />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" />
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
                defaultChecked={!contacts?.length}
                style={{ width: 16, height: 16 }}
              />
              <span>Primary contact for this site</span>
            </label>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
