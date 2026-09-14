import { requireAgency } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createWorker } from "@/app/agency/ops-actions";
import { ActionForm } from "@/components/agency/action-form";
import { WorkerRow, type WorkerRowData } from "@/components/agency/worker-row";

type Worker = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  do_not_return: boolean;
  notes: string | null;
  primary_craft_id: string | null;
  primary_level_id: string | null;
  craft: { name: string } | null;
  level: { name: string } | null;
};

const COLUMNS = 6;

export default async function WorkersPage() {
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

  const [{ data: workers }, { data: crafts }, { data: levels }] =
    await Promise.all([
      supabase
        .from("workers")
        .select(
          `id, first_name, last_name, email, phone, status, do_not_return, notes,
           primary_craft_id, primary_level_id,
           craft:crafts!workers_primary_craft_id_fkey(name),
           level:levels!workers_primary_level_id_fkey(name)`,
        )
        .is("deleted_at", null)
        .order("last_name")
        .returns<Worker[]>(),
      supabase.from("crafts").select("id, name").eq("is_active", true).order("sort_order"),
      supabase.from("levels").select("id, name").eq("is_active", true).order("rank"),
    ]);

  const rows = workers ?? [];
  const craftList = crafts ?? [];
  const levelList = levels ?? [];

  const activeCount = rows.filter(
    (w) => w.status !== "inactive" && !w.do_not_return,
  ).length;

  const rowData: WorkerRowData[] = rows.map((w) => ({
    id: w.id,
    first_name: w.first_name,
    last_name: w.last_name,
    email: w.email,
    phone: w.phone,
    status: w.status,
    do_not_return: w.do_not_return,
    notes: w.notes,
    primary_craft_id: w.primary_craft_id,
    primary_level_id: w.primary_level_id,
    craft_name: w.craft?.name ?? null,
    level_name: w.level?.name ?? null,
    has_twic: hasTwic.has(w.id),
  }));

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Workers</h2>
            <div className="sub">
              {rows.length} on file, {activeCount} active, {hasTwic.size} with a
              TWIC.
            </div>
          </div>
        </div>

        <table className="data-table">
          <colgroup>
            <col />
            <col style={{ width: 230 }} />
            <col style={{ width: 200 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 80 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Name</th>
              <th>Craft &amp; level</th>
              <th>Contact</th>
              <th>TWIC</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rowData.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={COLUMNS}>
                  No workers yet — add the first one below, then place them
                  against a requisition line.
                </td>
              </tr>
            ) : (
              rowData.map((w) => (
                <WorkerRow
                  key={w.id}
                  worker={w}
                  crafts={craftList}
                  levels={levelList}
                  columnCount={COLUMNS}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Add a worker</h2>
            <div className="sub">
              Name and craft are enough to start. Credentials and clearances get
              attached later.
            </div>
          </div>
        </div>

        <ActionForm action={createWorker} submitLabel="Add worker" resetOnSuccess>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "0 14px",
            }}
          >
            <label className="field">
              <span>
                First name <span className="req-star">*</span>
              </span>
              <input name="first_name" required />
            </label>
            <label className="field">
              <span>
                Last name <span className="req-star">*</span>
              </span>
              <input name="last_name" required />
            </label>
            <label className="field">
              <span>Phone</span>
              <input name="phone" type="tel" placeholder="(409) 555-0142" />
            </label>
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" />
            </label>
            <label className="field">
              <span>Primary craft</span>
              <select name="primary_craft_id" defaultValue="">
                <option value="">—</option>
                {craftList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Level</span>
              <select name="primary_level_id" defaultValue="">
                <option value="">—</option>
                {levelList.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 13,
              fontSize: 12.5,
            }}
          >
            <input type="checkbox" name="has_twic" style={{ width: 16, height: 16 }} />
            <span>Holds a TWIC card</span>
          </label>

          <label className="field">
            <span>Notes</span>
            <textarea name="notes" rows={2} />
          </label>
        </ActionForm>
      </div>
    </>
  );
}
