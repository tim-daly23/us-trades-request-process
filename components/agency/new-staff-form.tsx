"use client";

import { useState } from "react";
import { createPortalUser } from "@/app/agency/actions";
import { ActionForm } from "./action-form";
import { CredentialsOnce, type Created } from "./credentials-once";
import { AGENCY_ROLE_OPTIONS } from "./agency-roles";

/**
 * Creates a US Trades staff login.
 *
 * The account starts with no customers attached — deliberately. A new person
 * signing in sees an empty console until someone assigns them work, which is
 * the safe way round: the alternative is a new hire landing in every customer
 * on the platform by default.
 */
export function NewStaffForm({ disabled }: { disabled?: boolean }) {
  const [created, setCreated] = useState<Created | null>(null);

  if (disabled) {
    return (
      <div className="notice-warn">
        Staff logins need <code>SUPABASE_SERVICE_ROLE_KEY</code> in{" "}
        <code>.env.local</code> and in Vercel. Creating an auth account requires
        the Admin API.
      </div>
    );
  }

  return (
    <>
      {created && (
        <CredentialsOnce created={created} onDismiss={() => setCreated(null)} />
      )}

      <ActionForm
        action={createPortalUser}
        submitLabel="Create staff login"
        resetOnSuccess
        onSuccess={(data) => setCreated(data as Created)}
      >
        <input type="hidden" name="user_type" value="agency" />

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
            <input name="email" type="email" required placeholder="name@ustrades.com" />
          </label>

          <label className="field">
            <span>Full name</span>
            <input name="full_name" placeholder="Dana Reyes" />
          </label>

          <label className="field">
            <span>
              Role <span className="req-star">*</span>
            </span>
            <select name="role" required defaultValue="recruiter">
              {AGENCY_ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="hint" style={{ marginBottom: 12 }}>
          They start with no customers. Tick the ones they should have once the
          account exists.
        </div>
      </ActionForm>
    </>
  );
}
