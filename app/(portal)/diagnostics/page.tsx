import { createClient } from "@/lib/supabase/server";

/**
 * Session diagnostics.
 *
 * Shows the claims as they actually arrive in the JWT alongside the row counts
 * the database returns for them. Kept past its original purpose because it is
 * the fastest way to confirm a role or tenant change took effect — claims are
 * minted at sign-in, so a change made in SQL is invisible until the next token.
 */

type Claims = {
  sub?: string;
  email?: string;
  app_metadata?: {
    user_type?: string;
    customer_id?: string | null;
    customer_role?: string | null;
    agency_role?: string | null;
  };
};

/** Decode a JWT payload without verifying it — display only, never for auth. */
function decodeClaims(token: string): Claims | null {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    return JSON.parse(json) as Claims;
  } catch {
    return null;
  }
}

export default async function DiagnosticsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const claims = session?.access_token
    ? decodeClaims(session.access_token)
    : null;
  const meta = claims?.app_metadata ?? {};
  const hookWorking = Boolean(meta.user_type);

  const [customers, sites, requisitions, lines, crafts, workers] =
    await Promise.all([
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("sites").select("*", { count: "exact", head: true }),
      supabase.from("requisitions").select("*", { count: "exact", head: true }),
      supabase
        .from("requisition_lines")
        .select("*", { count: "exact", head: true }),
      supabase.from("crafts").select("*", { count: "exact", head: true }),
      supabase.from("workers").select("*", { count: "exact", head: true }),
    ]);

  const counts = [
    ["customers", customers.count],
    ["sites", sites.count],
    ["requisitions", requisitions.count],
    ["requisition_lines", lines.count],
    ["crafts", crafts.count],
    ["workers", workers.count],
  ] as const;

  const claimRows = [
    ["user_type", meta.user_type],
    ["customer_id", meta.customer_id],
    ["customer_role", meta.customer_role],
    ["agency_role", meta.agency_role],
  ] as const;

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Token claims</h2>
            <div className="sub">Signed in as {user?.email}</div>
          </div>
          <span className={`badge ${hookWorking ? "approved" : "pending"}`}>
            {hookWorking ? "Hook active" : "No claims"}
          </span>
        </div>

        {!hookWorking && (
          <div className="notice-warn" style={{ marginBottom: 14 }}>
            No user_type in app_metadata — the access token hook is not enabled,
            or this account has no app_users row. Every count below will read
            zero.
          </div>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <th>Claim</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {claimRows.map(([k, v]) => (
              <tr key={k}>
                <td className="mono" style={{ color: "var(--steel)" }}>
                  {k}
                </td>
                <td className="mono">{v ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Rows visible to this session</h2>
            <div className="sub">
              Counts come back through row-level security, so they are what this
              session can genuinely reach — not a query filtered in the app.
            </div>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Table</th>
              <th style={{ width: 100 }}>Rows</th>
            </tr>
          </thead>
          <tbody>
            {counts.map(([name, count]) => (
              <tr key={name}>
                <td className="mono" style={{ color: "var(--steel)" }}>
                  {name}
                </td>
                <td className="mono">{count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
