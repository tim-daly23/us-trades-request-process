import Link from "next/link";
import { requireAgency } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/agency/print-button";

type Worker = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  status: string;
  do_not_return: boolean;
  craft: { name: string } | null;
  level: { name: string } | null;
};

/**
 * The active roster, on paper.
 *
 * Sorted by craft and then by surname rather than straight alphabetically:
 * a printed roster gets read to answer "who have we got that welds", and a
 * flat A-Z makes you scan every line to find out.
 */
export default async function WorkerRosterReport() {
  await requireAgency();
  const supabase = await createClient();

  const { data: twic } = await supabase
    .from("credentials")
    .select("id")
    .eq("code", "TWIC")
    .is("customer_id", null)
    .maybeSingle();

  const { data: twicHolders } = twic
    ? await supabase
        .from("worker_credentials")
        .select("worker_id")
        .eq("credential_id", twic.id)
        .in("state", ["verified", "submitted"])
    : { data: [] };

  const hasTwic = new Set((twicHolders ?? []).map((r) => r.worker_id));

  const { data: workers } = await supabase
    .from("workers")
    .select(
      `id, first_name, last_name, phone, status, do_not_return,
       craft:crafts!workers_primary_craft_id_fkey(name),
       level:levels!workers_primary_level_id_fkey(name)`,
    )
    .is("deleted_at", null)
    .neq("status", "inactive")
    .eq("do_not_return", false)
    .returns<Worker[]>();

  const rows = (workers ?? []).sort((a, b) => {
    const craftA = a.craft?.name ?? "￿";
    const craftB = b.craft?.name ?? "￿";
    if (craftA !== craftB) return craftA.localeCompare(craftB);
    return a.last_name.localeCompare(b.last_name);
  });

  const twicCount = rows.filter((w) => hasTwic.has(w.id)).length;

  const printed = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          gap: 12,
        }}
      >
        <Link
          href="/agency/workers"
          style={{
            fontSize: 12.5,
            color: "var(--steel)",
            textDecoration: "none",
            borderBottom: "1px dotted var(--steel)",
          }}
        >
          ← Back to workers
        </Link>
        <PrintButton />
      </div>

      <div className="panel report-sheet">
        <div className="report-head">
          <div>
            <h1>Active Worker Roster</h1>
            <div style={{ fontSize: 12, color: "var(--steel)", marginTop: 2 }}>
              US Trades LLC
            </div>
          </div>
          <div className="report-meta">
            <div>{printed}</div>
            <div>
              {rows.length} active · {twicCount} with a TWIC
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <p style={{ margin: 0, color: "var(--steel)" }}>
            No active workers on the roster.
          </p>
        ) : (
          <table className="report-table">
            <thead>
              <tr>
                <th style={{ width: "28%" }}>Name</th>
                <th style={{ width: "24%" }}>Craft</th>
                <th style={{ width: "18%" }}>Level</th>
                <th style={{ width: "18%" }}>Phone</th>
                <th style={{ width: "12%" }}>TWIC</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 500 }}>
                    {w.last_name}, {w.first_name}
                  </td>
                  <td>{w.craft?.name ?? "—"}</td>
                  <td>{w.level?.name ?? "—"}</td>
                  <td className="mono">{w.phone ?? "—"}</td>
                  {/* Spelled out rather than badged: background colours are
                      dropped by default in print, and a colourless badge says
                      nothing. */}
                  <td style={{ fontWeight: hasTwic.has(w.id) ? 600 : 400 }}>
                    {hasTwic.has(w.id) ? "Yes" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
