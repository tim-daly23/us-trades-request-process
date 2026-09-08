"use client";

export type Created = { email: string; password: string };

/**
 * The generated password, shown exactly once.
 *
 * It is not stored anywhere retrievable — if it is lost the account gets a new
 * one rather than someone looking the old one up. Shared by the customer-login
 * and staff-login forms so both say the same thing about that.
 */
export function CredentialsOnce({
  created,
  onDismiss,
}: {
  created: Created;
  onDismiss: () => void;
}) {
  return (
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
        onClick={onDismiss}
      >
        Done
      </button>
    </div>
  );
}
