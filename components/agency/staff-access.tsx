"use client";

import { useState } from "react";
import { ActionForm } from "./action-form";
import { AGENCY_ROLE_OPTIONS, agencyRoleLabel } from "./agency-roles";
import {
  setStaffActive,
  setStaffCustomers,
  setStaffRole,
} from "@/app/agency/team-actions";

export type CustomerOption = { id: string; display_name: string };

export type StaffMember = {
  id: string;
  email: string;
  full_name: string | null;
  agency_role: string | null;
  is_active: boolean;
};

/**
 * One person on the roster, plus the controls for what they can reach.
 *
 * Renders two table rows — the summary and, when opened, a full-width panel
 * beneath it. Two rows rather than a cell that grows, so the checkbox grid
 * gets the whole table width instead of the last column's 110 pixels.
 *
 * Collapsed by default: the list answers "who is on the team" at a glance, and
 * opening someone is the deliberate act of changing their access.
 */
export function StaffRow({
  user,
  isSelf,
  customers,
  assigned,
  columnCount,
}: {
  user: StaffMember;
  isSelf: boolean;
  customers: CustomerOption[];
  assigned: string[];
  columnCount: number;
}) {
  const [open, setOpen] = useState(false);

  const isAdmin = user.agency_role === "super_admin";
  const name = user.full_name ?? user.email;
  const assignedSet = new Set(assigned);
  const nameFor = new Map(customers.map((c) => [c.id, c.display_name]));

  return (
    <>
      <tr>
        <td>
          <div style={{ fontWeight: 500 }}>
            {name}
            {isSelf && (
              <span className="badge inactive" style={{ marginLeft: 6 }}>
                you
              </span>
            )}
          </div>
          <div className="mono" style={{ fontSize: 11.5, color: "var(--steel)" }}>
            {user.email}
          </div>
        </td>
        <td>
          <span className={`badge ${isAdmin ? "approved" : "inactive"}`}>
            {agencyRoleLabel(user.agency_role)}
          </span>
        </td>
        <td style={{ color: "var(--steel)", fontSize: 12.5 }}>
          {isAdmin ? (
            "All customers"
          ) : assigned.length === 0 ? (
            <span style={{ color: "var(--brand-red)" }}>None yet</span>
          ) : (
            assigned
              .map((id) => nameFor.get(id) ?? "—")
              .sort()
              .join(", ")
          )}
        </td>
        <td>
          <span className={`badge ${user.is_active ? "working" : "declined"}`}>
            {user.is_active ? "Active" : "Off"}
          </span>
        </td>
        <td>
          <button
            type="button"
            className="action-btn"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Manage"}
          </button>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={columnCount} style={{ background: "var(--paper)" }}>
            <div
              style={{
                fontFamily: "var(--font-barlow)",
                fontSize: 15,
                letterSpacing: ".02em",
                marginBottom: 10,
              }}
            >
              Customer access — {name}
            </div>

            {isAdmin ? (
              <div className="hint" style={{ marginBottom: 4 }}>
                A super admin reaches every customer, including ones added
                later. Change the role below first if they should be scoped.
              </div>
            ) : customers.length === 0 ? (
              <div className="hint" style={{ marginBottom: 4 }}>
                No customers exist yet.
              </div>
            ) : (
              <ActionForm action={setStaffCustomers} submitLabel="Save access">
                <input type="hidden" name="user_id" value={user.id} />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: "6px 14px",
                    marginBottom: 13,
                  }}
                >
                  {customers.map((c) => (
                    <label
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 12.5,
                      }}
                    >
                      <input
                        type="checkbox"
                        name="customer_ids"
                        value={c.id}
                        defaultChecked={assignedSet.has(c.id)}
                        style={{ width: 16, height: 16 }}
                      />
                      <span>{c.display_name}</span>
                    </label>
                  ))}
                </div>
              </ActionForm>
            )}

            <div
              style={{
                borderTop: "1px solid var(--line)",
                marginTop: 14,
                paddingTop: 12,
                display: "flex",
                gap: 28,
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <div style={{ minWidth: 280 }}>
                <ActionForm
                  action={setStaffRole}
                  submitLabel="Save role"
                  submitClass="action-btn"
                >
                  <input type="hidden" name="user_id" value={user.id} />
                  <label className="field">
                    <span>Role</span>
                    <select
                      name="agency_role"
                      defaultValue={user.agency_role ?? "recruiter"}
                      disabled={isSelf}
                    >
                      {AGENCY_ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </ActionForm>
                <div className="hint" style={{ marginTop: 6 }}>
                  {isSelf
                    ? "You cannot change your own role."
                    : "Takes effect the next time they sign in — the role travels in their access token. Customer ticks apply immediately."}
                </div>
              </div>

              {!isSelf && (
                <div>
                  <ActionForm
                    action={setStaffActive}
                    submitLabel={
                      user.is_active ? "Deactivate login" : "Reactivate login"
                    }
                    submitClass="action-btn"
                    confirm={
                      user.is_active
                        ? `Deactivate ${name}? They keep the account but cannot sign in.`
                        : undefined
                    }
                  >
                    <input type="hidden" name="user_id" value={user.id} />
                    <input
                      type="hidden"
                      name="is_active"
                      value={user.is_active ? "false" : "true"}
                    />
                  </ActionForm>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
