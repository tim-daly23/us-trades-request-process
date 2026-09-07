"use client";

import { useState } from "react";
import {
  setUserActive,
  deletePortalUser,
  resetPortalUserPassword,
} from "@/app/agency/actions";
import { ActionForm } from "./action-form";

/**
 * Per-user controls in the logins table.
 *
 * Client-side because a reset returns a password that must be shown once and
 * then forgotten — there is nowhere to read it back from.
 */
export function UserRowActions({
  id,
  email,
  isActive,
  canDelete,
}: {
  id: string;
  email: string;
  isActive: boolean;
  /** False for the signed-in user — you cannot remove your own account. */
  canDelete: boolean;
}) {
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(
    null,
  );

  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <ActionForm
          action={setUserActive}
          submitLabel={isActive ? "Disable" : "Enable"}
          submitClass="action-btn"
          inline
          confirm={
            isActive
              ? `Disable ${email}? They keep their password but see no data.`
              : undefined
          }
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="is_active" value={isActive ? "false" : "true"} />
        </ActionForm>

        <ActionForm
          action={resetPortalUserPassword}
          submitLabel="Reset password"
          submitClass="action-btn"
          inline
          confirm={`Issue a new password for ${email}? Their current one stops working immediately.`}
          onSuccess={(d) => setIssued(d as { email: string; password: string })}
        >
          <input type="hidden" name="id" value={id} />
        </ActionForm>

        {canDelete && (
          <ActionForm
            action={deletePortalUser}
            submitLabel="Remove"
            submitClass="action-btn"
            inline
            confirm={`Permanently remove ${email} and their sign-in account?`}
          >
            <input type="hidden" name="id" value={id} />
          </ActionForm>
        )}
      </div>

      {issued && (
        <div
          style={{
            background: "var(--green-dim)",
            border: "1px solid var(--green)",
            padding: "10px 12px",
            marginTop: 8,
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>
            New password for {issued.email}
          </div>
          <div
            className="mono"
            style={{
              background: "#fff",
              border: "1px solid var(--line-strong)",
              padding: "3px 7px",
              marginTop: 5,
              display: "inline-block",
              userSelect: "all",
            }}
          >
            {issued.password}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--steel)", marginTop: 6 }}>
            Shown once. Their old password no longer works.
          </div>
          <button
            type="button"
            className="action-btn"
            style={{ marginTop: 8 }}
            onClick={() => setIssued(null)}
          >
            Done
          </button>
        </div>
      )}
    </>
  );
}
