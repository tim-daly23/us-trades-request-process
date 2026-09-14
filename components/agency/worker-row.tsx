"use client";

import { useState } from "react";
import { ActionForm } from "./action-form";
import { deleteWorker, updateWorker } from "@/app/agency/ops-actions";

export type Option = { id: string; name: string };

export type WorkerRowData = {
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
  craft_name: string | null;
  level_name: string | null;
  has_twic: boolean;
};

/**
 * One worker, with the edit form folded underneath.
 *
 * Two table rows rather than a link to a detail page: the roster is the thing
 * you scan down when the phone rings, and correcting a number should not cost
 * you your place in it.
 */
export function WorkerRow({
  worker,
  crafts,
  levels,
  columnCount,
}: {
  worker: WorkerRowData;
  crafts: Option[];
  levels: Option[];
  columnCount: number;
}) {
  const [open, setOpen] = useState(false);

  const active = worker.status !== "inactive" && !worker.do_not_return;
  const name = `${worker.first_name} ${worker.last_name}`;

  return (
    <>
      <tr>
        <td style={{ fontWeight: 500 }}>
          {worker.last_name}, {worker.first_name}
          {worker.do_not_return && (
            <span className="badge declined" style={{ marginLeft: 6 }}>
              DNR
            </span>
          )}
        </td>
        <td style={{ color: "var(--steel)" }}>
          {worker.craft_name ?? "—"}
          {worker.level_name ? ` · ${worker.level_name}` : ""}
        </td>
        <td style={{ fontSize: 12 }}>
          <div className="mono">{worker.phone ?? "—"}</div>
          <div style={{ color: "var(--steel-dim)" }}>{worker.email ?? ""}</div>
        </td>
        <td>
          {worker.has_twic ? (
            <span className="badge submitted">TWIC</span>
          ) : (
            <span style={{ color: "var(--steel-dim)" }}>—</span>
          )}
        </td>
        <td>
          <span className={`badge ${active ? "working" : "inactive"}`}>
            {active ? "Active" : "Inactive"}
          </span>
        </td>
        <td>
          <button
            type="button"
            className="action-btn"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Edit"}
          </button>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={columnCount} style={{ background: "var(--paper)" }}>
            <ActionForm action={updateWorker} submitLabel="Save changes">
              <input type="hidden" name="id" value={worker.id} />

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
                  <input
                    name="first_name"
                    required
                    defaultValue={worker.first_name}
                  />
                </label>
                <label className="field">
                  <span>
                    Last name <span className="req-star">*</span>
                  </span>
                  <input
                    name="last_name"
                    required
                    defaultValue={worker.last_name}
                  />
                </label>
                <label className="field">
                  <span>Phone</span>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={worker.phone ?? ""}
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    name="email"
                    type="email"
                    defaultValue={worker.email ?? ""}
                  />
                </label>
                <label className="field">
                  <span>Primary craft</span>
                  <select
                    name="primary_craft_id"
                    defaultValue={worker.primary_craft_id ?? ""}
                  >
                    <option value="">—</option>
                    {crafts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Level</span>
                  <select
                    name="primary_level_id"
                    defaultValue={worker.primary_level_id ?? ""}
                  >
                    <option value="">—</option>
                    {levels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: "flex", gap: 20, marginBottom: 13 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12.5,
                  }}
                >
                  <input
                    type="checkbox"
                    name="has_twic"
                    defaultChecked={worker.has_twic}
                    style={{ width: 16, height: 16 }}
                  />
                  <span>Holds a TWIC card</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12.5,
                  }}
                >
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={active}
                    style={{ width: 16, height: 16 }}
                  />
                  <span>Active</span>
                </label>
              </div>

              <label className="field">
                <span>Notes</span>
                <textarea name="notes" rows={2} defaultValue={worker.notes ?? ""} />
              </label>
            </ActionForm>

            <div
              style={{
                borderTop: "1px solid var(--line)",
                marginTop: 14,
                paddingTop: 12,
              }}
            >
              <ActionForm
                action={deleteWorker}
                submitLabel="Delete worker"
                submitClass="action-btn danger"
                confirm={`Delete ${name} from the roster? If they have ever been placed, the placement history is kept and they are simply taken off the list.`}
              >
                <input type="hidden" name="id" value={worker.id} />
              </ActionForm>
              <div className="hint" style={{ marginTop: 6 }}>
                To take someone off the board without losing them, untick Active
                instead — they stay on file and can be switched back on.
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
