import { requireAgency } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createWorker } from "@/app/agency/ops-actions";
import { ActionForm } from "@/components/agency/action-form";

type Worker = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  home_city: string | null;
  home_state: string | null;
  years_experience: number | string | null;
  do_not_return: boolean;
  craft: { name: string } | null;
  level: { name: string } | null;
};

const TONE: Record<string, string> = {
  available: "approved",
  assigned: "working",
  candidate: "submitted",
  lead: "pending",
  inactive: "inactive",
  do_not_return: "declined",
};

export default async function WorkersPage() {
  await requireAgency();
  const supabase = await createClient();

  const [{ data: workers }, { data: crafts }, { data: levels }] =
    await Promise.all([
      supabase
        .from("workers")
        .select(
          `id, first_name, last_name, email, phone, status, home_city, home_state,
           years_experience, do_not_return,
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

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Workers</h2>
            <div className="sub">
              {rows.length} on file. Candidates and employees are the same
              record — status is what changes.
            </div>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 200 }}>Craft &amp; level</th>
              <th style={{ width: 150 }}>Home</th>
              <th style={{ width: 70 }}>Yrs</th>
              <th style={{ width: 180 }}>Contact</th>
              <th style={{ width: 120 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={6}>
                  No workers yet — add the first one below, then place them
                  against a requisition line.
                </td>
              </tr>
            ) : (
              rows.map((w) => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 500 }}>
                    {w.last_name}, {w.first_name}
                    {w.do_not_return && (
                      <span className="badge declined" style={{ marginLeft: 6 }}>
                        DNR
                      </span>
                    )}
                  </td>
                  <td style={{ color: "var(--steel)" }}>
                    {w.craft?.name ?? "—"}
                    {w.level?.name ? ` · ${w.level.name}` : ""}
                  </td>
                  <td style={{ color: "var(--steel)" }}>
                    {[w.home_city, w.home_state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="mono">
                    {w.years_experience ? Number(w.years_experience) : "—"}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <div className="mono">{w.phone ?? "—"}</div>
                    <div style={{ color: "var(--steel-dim)" }}>{w.email ?? ""}</div>
                  </td>
                  <td>
                    <span className={`badge ${TONE[w.status] ?? "inactive"}`}>
                      {w.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
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
                {(crafts ?? []).map((c) => (
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
                {(levels ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Years experience</span>
              <input name="years_experience" type="number" min="0" step="0.5" />
            </label>
            <label className="field">
              <span>Home city</span>
              <input name="home_city" placeholder="Beaumont" />
            </label>
            <label className="field">
              <span>Home state</span>
              <input name="home_state" maxLength={2} placeholder="TX" />
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue="available">
                <option value="lead">Lead</option>
                <option value="candidate">Candidate</option>
                <option value="available">Available</option>
                <option value="assigned">Assigned</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span>Notes</span>
            <textarea name="notes" rows={2} />
          </label>
        </ActionForm>
      </div>
    </>
  );
}
