"use client";

import { useState } from "react";
import { createPortalUser } from "@/app/agency/actions";
import { ActionForm } from "./action-form";

type Created = { email: string; password: string };

/**
 * Creates a portal login and shows the generated password exactly once.
 *
 * It is deliberately not stored anywhere retrievable — if it is lost, the
 * account gets a new one rather than someone looking the old one up.
 */
export function NewPortalUserForm({
  customerId,
  disabled,
}: {
  customerId: string;
  disabled?: boolean;
}) {
  const [created, setCreated] = useState<Created | null>(null);

  if (disabled) {
    return (
      <div className="notice-warn">
        Portal logins need <code>SUPABASE_SERVICE_ROLE_KEY</code> in{" "}
        <code>.env.local</code>. Creating an auth account requires the Admin
        API.
      </div>
    );
  }

  return (
    <>
      {created && (
        <div
          className="panel"
          style={{
            background: "var(--green-dim)",
            borderColor: "var(--green)",
            marginBottom: 14,
          }}
        >
          <strong style={{ fontFamily: "var(--font-barlow)", fontSize: 16 }}>
            Login created — copy this now
          </strong>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <div>
              <span style={{ color: "var(--steel)" }}>Email: </span>
              <span className="mono">{created.email}</span>
            </div>
            <div style={{ marginTop: 4 }}>
              <span style={{ color: "var(--steel)" }}>Password: </span>
              <span
                className="mono"
                style={{
                  background: "#fff",
                  border: "1px solid var(--line-strong)",
                  padding: "2px 6px",
                  userSelect: "all",
                }}
              >
                {created.password}
              </span>
            </div>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            This is shown once and is not recoverable. Send it to them over a
            channel you trust and have them change it after first sign-in.
          </div>
          <button
            type="button"
            className="action-btn"
            style={{ marginTop: 10 }}
            onClick={() => setCreated(null)}
          >
            Done
          </button>
        </div>
      )}

      <ActionForm
        action={createPortalUser}
        submitLabel="Create login"
        resetOnSuccess
        onSuccess={(data) => setCreated(data as Created)}
      >
        <input type="hidden" name="customer_id" value={customerId} />
        <input type="hidden" name="user_type" value="customer" />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "0 14px",
          }}
        >
          <label className="field">
            <span>
              Work email <span className="req-star">*</span>
            </span>
            <input name="email" type="email" required />
          </label>

          <label className="field">
            <span>Full name</span>
            <input name="full_name" placeholder="Jim Holloway" />
          </label>

          <label className="field">
            <span>
              Role <span className="req-star">*</span>
            </span>
            <select name="role" required defaultValue="requester">
              <option value="customer_admin">
                Admin — manages their users, sees rates
              </option>
              <option value="approver">Approver — approves, sees rates</option>
              <option value="requester">Requester — raises requests</option>
              <option value="viewer">Viewer — read only</option>
            </select>
          </label>
        </div>
      </ActionForm>
    </>
  );
}
