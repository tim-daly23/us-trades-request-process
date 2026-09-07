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
    <div className="flex flex-col">
      <div className="border-b border-line bg-surface px-[26px] py-[18px]">
        <h1 className="text-[22px] font-medium tracking-[-0.012em]">
          Session diagnostics
        </h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Signed in as {user?.email}
        </p>
      </div>

      <div className="grid gap-[18px] p-[18px_26px] lg:grid-cols-2">
        <section className="border border-line bg-surface">
          <h2 className="eyebrow border-b border-line px-4 py-2.5">
            Token claims
          </h2>

          <p
            className={`px-4 py-3 text-[12.5px] ${
              hookWorking
                ? "bg-ok-soft text-ok-soft-fg"
                : "bg-warn-soft text-warn-soft-fg"
            }`}
          >
            {hookWorking
              ? "Access token hook is applying claims."
              : "No user_type in app_metadata — the hook is not enabled, or this account has no app_users row. Every count below will read zero."}
          </p>

          <dl className="px-4 py-3">
            {claimRows.map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between gap-4 border-b border-line-soft py-2 last:border-0"
              >
                <dt className="num text-[12px] text-muted">{k}</dt>
                <dd className="num truncate text-[12px]">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border border-line bg-surface">
          <h2 className="eyebrow border-b border-line px-4 py-2.5">
            Rows visible to this session
          </h2>
          <dl className="px-4 py-3">
            {counts.map(([name, count]) => (
              <div
                key={name}
                className="flex justify-between gap-4 border-b border-line-soft py-2 last:border-0"
              >
                <dt className="num text-[12px] text-muted">{name}</dt>
                <dd className="num text-[12px] font-medium">{count ?? 0}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-muted-2">
            Counts come back through RLS, so they are what this session can
            genuinely reach — not a query filtered in the app.
          </p>
        </section>
      </div>
    </div>
  );
}
