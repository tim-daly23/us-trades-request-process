import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgency } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRole } from "@/lib/supabase/admin";
import {
  updateCustomer,
  createSite,
  deleteCustomer,
} from "@/app/agency/actions";
import { UserRowActions } from "@/components/agency/user-row-actions";
import { ActionForm } from "@/components/agency/action-form";
import { NewPortalUserForm } from "@/components/agency/new-portal-user-form";
import { SafetyCouncilField } from "@/components/safety-council-field";
import { formatMoney, formatSchedule } from "@/lib/format";

export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireAgency();
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!customer) notFound();

  const [{ data: sites }, { data: users }, { count: reqCount }] =
    await Promise.all([
    supabase
      .from("sites")
      .select("*, contacts:site_contacts(name, phone, role, is_primary)")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("app_users")
      .select("id, email, full_name, customer_role, is_active, last_login_at")
      .eq("customer_id", id)
      .order("email"),
    supabase
      .from("requisitions")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", id),
  ]);

  const { data: twic } = await supabase
    .from("credentials")
    .select("id")
    .eq("code", "TWIC")
    .is("customer_id", null)
    .maybeSingle();

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <Link
          href="/agency/customers"
          style={{
            fontSize: 12.5,
            color: "var(--steel)",
            textDecoration: "none",
            borderBottom: "1px dotted var(--steel)",
          }}
        >
          ← All customers
        </Link>
      </div>

      {/* ---------------------------------------------------- settings */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>{customer.display_name}</h2>
            <div className="sub">
              <span className="mono">{customer.slug}</span> · {customer.legal_name}
            </div>
          </div>
        </div>

        <ActionForm action={updateCustomer} submitLabel="Save changes">
          <input type="hidden" name="id" value={id} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "0 14px",
            }}
          >
            <label className="field">
              <span>Display name</span>
              <input name="display_name" defaultValue={customer.display_name} />
            </label>
            <label className="field">
              <span>Legal name</span>
              <input name="legal_name" defaultValue={customer.legal_name} />
            </label>
            <label className="field">
              <span>Billing email</span>
              <input
                name="billing_email"
                type="email"
                defaultValue={customer.billing_email ?? ""}
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={customer.status}>
                <option value="prospect">Prospect</option>
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <fieldset
            style={{
              border: "1px solid var(--line)",
              padding: "12px 14px",
              margin: "6px 0 14px",
            }}
          >
            <legend
              style={{ fontSize: 12, color: "var(--steel)", padding: "0 6px" }}
            >
              Portal behaviour
            </legend>
            <Check
              name="candidate_approval_required"
              defaultChecked={customer.candidate_approval_required}
              label="Customer approves each candidate before onboarding"
            />
            <Check
              name="show_bill_rates"
              defaultChecked={customer.show_bill_rates}
              label="Show bill rates (admins and approvers only)"
            />
            <Check
              name="requires_internal_approval"
              defaultChecked={customer.requires_internal_approval}
              label="Their requesters need internal approval before a request reaches us"
            />
            <Check
              name="show_worker_contact_info"
              defaultChecked={customer.show_worker_contact_info}
              label="Show worker names and contact details before approval"
            />
          </fieldset>
        </ActionForm>
      </div>

      {/* ------------------------------------------------------- logins */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Portal logins</h2>
            <div className="sub">
              Who at {customer.display_name} can sign in, and what they can do.
            </div>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th style={{ width: 190 }}>Role</th>
              <th style={{ width: 130 }}>Last sign-in</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 230 }} />
            </tr>
          </thead>
          <tbody>
            {!users?.length ? (
              <tr className="empty-row">
                <td colSpan={5}>
                  No logins yet — nobody at this customer can sign in.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{u.full_name ?? "—"}</div>
                    <div className="mono" style={{ fontSize: 11.5, color: "var(--steel)" }}>
                      {u.email}
                    </div>
                  </td>
                  <td style={{ color: "var(--steel)" }}>
                    {(u.customer_role ?? "").replace(/_/g, " ")}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleDateString("en-US")
                      : "never"}
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? "approved" : "inactive"}`}>
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td>
                    <UserRowActions
                      id={u.id}
                      email={u.email}
                      isActive={u.is_active}
                      canDelete={u.id !== me.id}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>Create a login</h3>
          <NewPortalUserForm customerId={id} disabled={!hasServiceRole()} />
        </div>

        <div className="hint">
          Disabling strips their claims at the next sign-in — they can still
          authenticate but see nothing, and their history is kept. Removing
          deletes the sign-in account outright, and is refused for anyone who
          has raised or approved a request.
        </div>
      </div>

      {/* -------------------------------------------------------- sites */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Sites</h2>
            <div className="sub">
              A request must point at a site. Defaults here pre-fill their
              request form.
            </div>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Site</th>
              <th style={{ width: 180 }}>Location</th>
              <th style={{ width: 140 }}>Default schedule</th>
              <th style={{ width: 100 }}>Per diem</th>
              <th style={{ width: 190 }}>Site contact</th>
              <th style={{ width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {!sites?.length ? (
              <tr className="empty-row">
                <td colSpan={6}>
                  No sites yet — they cannot raise a request until there is one.
                </td>
              </tr>
            ) : (
              sites.map((s) => (
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
                    {s.city}, {s.state}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {formatSchedule(s.default_days_per_week, s.default_hours_per_day)}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {formatMoney(s.default_per_diem_rate)}
                  </td>
                  <td>
                    {(() => {
                      const list = (s.contacts ?? []) as {
                        name: string;
                        phone: string | null;
                        role: string | null;
                        is_primary: boolean;
                      }[];
                      const c = list.find((x) => x.is_primary) ?? list[0];
                      if (!c)
                        return (
                          <span style={{ color: "var(--steel-dim)" }}>—</span>
                        );
                      return (
                        <>
                          <div style={{ fontSize: 12.5 }}>
                            {c.name}
                            {c.role ? (
                              <span style={{ color: "var(--steel-dim)" }}>
                                {" "}
                                · {c.role}
                              </span>
                            ) : null}
                          </div>
                          <div className="mono" style={{ fontSize: 11.5, color: "var(--steel)" }}>
                            {c.phone ?? "—"}
                          </div>
                        </>
                      );
                    })()}
                  </td>
                  <td>
                    <Link href={`/agency/sites/${s.id}`} className="action-btn">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>Add a site</h3>
          <ActionForm action={createSite} submitLabel="Add site" resetOnSuccess>
            <input type="hidden" name="customer_id" value={id} />
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
                <input name="state" placeholder="TX" maxLength={2} />
              </label>
              <label className="field">
                <span>ZIP</span>
                <input name="postal_code" placeholder="77520" />
              </label>
            </div>

            <fieldset
              style={{
                border: "1px solid var(--line)",
                padding: "12px 14px",
                margin: "6px 0 14px",
              }}
            >
              <legend style={{ fontSize: 12, color: "var(--steel)", padding: "0 6px" }}>
                Site access requirements
              </legend>
              <Check
                name="requires_twic"
                label="TWIC card is required to enter this site"
              />
              <SafetyCouncilField />
            </fieldset>

            <div className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
              Schedule, per diem and site contacts are not asked for here —
              they change job to job. Set them on the site afterwards if you
              want them pre-filled on the request form.
            </div>
          </ActionForm>
        </div>
      </div>

      {/* --------------------------------------------------- danger zone */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Delete this customer</h2>
            <div className="sub">
              Removes {customer.display_name} and everything belonging to them.
            </div>
          </div>
        </div>

        <div className="notice-warn" style={{ marginBottom: 14 }}>
          This deletes <strong>{sites?.length ?? 0}</strong> site
          {sites?.length === 1 ? "" : "s"},{" "}
          <strong>{reqCount ?? 0}</strong> requisition
          {reqCount === 1 ? "" : "s"} with their craft lines and placements, and{" "}
          <strong>{users?.length ?? 0}</strong> portal login
          {users?.length === 1 ? "" : "s"} including their sign-in accounts.
          Workers stay on file. There is no undo.
        </div>

        <ActionForm
          action={deleteCustomer}
          submitLabel="Delete customer"
          submitClass="action-btn"
          redirectTo="/agency/customers"
          confirm={`Delete ${customer.display_name} and everything under it?`}
        >
          <input type="hidden" name="id" value={id} />
          <label className="field" style={{ maxWidth: 320 }}>
            <span>
              Type <span className="mono">{customer.slug}</span> to confirm
            </span>
            <input name="confirm_slug" autoComplete="off" placeholder={customer.slug} />
          </label>
        </ActionForm>
      </div>
    </>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        marginBottom: 8,
        fontSize: 12.5,
      }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        style={{ width: 16, height: 16, marginTop: 1 }}
      />
      <span>{label}</span>
    </label>
  );
}
