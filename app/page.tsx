import { createClient } from "@/lib/supabase/server";

/**
 * Diagnostic home page.
 *
 * Temporary, but it is the only honest test of the access token hook: it shows
 * the claims as they actually arrive in the JWT, and the row counts the
 * database returns for those claims. If the hook is not enabled, app_metadata
 * comes back without user_type and every count reads zero.
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

export default async function Home() {
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

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          US Trades Portal
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Signed in as {user?.email}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Token claims
        </h2>
        <div
          className={`rounded-lg border p-4 text-sm ${
            hookWorking
              ? "border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
              : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
          }`}
        >
          {hookWorking ? (
            <p className="font-medium">Access token hook is working.</p>
          ) : (
            <p className="font-medium">
              No user_type in app_metadata — the access token hook is not
              enabled, or this account has no app_users row. Every query below
              will return zero.
            </p>
          )}
          <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-y-1 font-mono text-xs">
            <dt className="text-neutral-500">user_type</dt>
            <dd>{meta.user_type ?? "—"}</dd>
            <dt className="text-neutral-500">customer_id</dt>
            <dd>{meta.customer_id ?? "—"}</dd>
            <dt className="text-neutral-500">customer_role</dt>
            <dd>{meta.customer_role ?? "—"}</dd>
            <dt className="text-neutral-500">agency_role</dt>
            <dd>{meta.agency_role ?? "—"}</dd>
          </dl>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Rows visible to this session
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {counts.map(([name, count]) => (
              <tr
                key={name}
                className="border-b border-neutral-200 dark:border-neutral-800"
              >
                <td className="py-2 font-mono text-xs text-neutral-500">
                  {name}
                </td>
                <td className="py-2 text-right font-medium tabular-nums">
                  {count ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-neutral-500">
          A customer session should see 1 / 1 / 1 / 2 / 17 / 0. An agency
          session sees the same here only because there is one tenant so far —
          the difference shows once a second customer exists.
        </p>
      </section>

      <form action="/auth/signout" method="post">
        <button className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900">
          Sign out
        </button>
      </form>
    </main>
  );
}
