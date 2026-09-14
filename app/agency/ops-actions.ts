"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAgency } from "@/lib/auth";

type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

const nz = (v: FormDataEntryValue | null): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";
const num = (v: FormDataEntryValue | null): number | null => {
  const s = nz(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// =====================================================================
// Requisitions
// =====================================================================

/** Edit the job details. Agency staff are not limited to the draft window. */
export async function updateRequisition(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  if (!id) return { ok: false, error: "Missing requisition." };

  const start = nz(form.get("start_date"));
  const end = nz(form.get("end_date"));
  if (start && end && end < start) {
    return { ok: false, error: "End date cannot be before the start date." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("requisitions")
    .update({
      title: nz(form.get("title")),
      project_name: nz(form.get("project_name")),
      cost_code: nz(form.get("cost_code")),
      urgency: nz(form.get("urgency")) ?? "standard",
      start_date: start,
      end_date: end,
      duration_weeks: num(form.get("duration_weeks")),
      shift: nz(form.get("shift")) ?? "day",
      hours_per_day: num(form.get("hours_per_day")) ?? 10,
      days_per_week: num(form.get("days_per_week")) ?? 6,
      per_diem_rate: num(form.get("per_diem_rate")),
      scope_of_work: nz(form.get("scope_of_work")),
      special_instructions: nz(form.get("special_instructions")),
      owner_user_id: nz(form.get("owner_user_id")),
      customer_job_id: nz(form.get("customer_job_id")),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/agency/requisitions/${id}`);
  return { ok: true };
}

/**
 * Move a requisition through its lifecycle.
 *
 * Acknowledging stamps who did it and when — that is the moment US Trades
 * takes responsibility for filling the request, so it should be attributable.
 */
export async function setRequisitionStatus(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  const status = nz(form.get("status"));
  if (!id || !status) return { ok: false, error: "Missing requisition or status." };

  const reason = nz(form.get("cancelled_reason"));
  if (status === "cancelled" && !reason) {
    return { ok: false, error: "A reason is required to cancel a request." };
  }

  const patch: Record<string, unknown> = { status };
  if (status === "acknowledged") {
    patch.acknowledged_by = guard.profile.id;
    patch.acknowledged_at = new Date().toISOString();
  }
  if (status === "cancelled") {
    patch.cancelled_reason = reason;
    patch.closed_at = new Date().toISOString();
  }
  if (status === "completed") {
    patch.closed_at = new Date().toISOString();
  }

  const supabase = await createClient();
  const { error } = await supabase.from("requisitions").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/agency/requisitions/${id}`);
  revalidatePath("/agency");
  return { ok: true };
}

/** Add a craft line to an existing requisition. */
export async function addRequisitionLine(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const requisitionId = nz(form.get("requisition_id"));
  const craftId = nz(form.get("craft_id"));
  const levelId = nz(form.get("level_id"));
  const quantity = num(form.get("quantity")) ?? 0;
  if (!requisitionId || !craftId || !levelId || quantity < 1) {
    return { ok: false, error: "Craft, level and a quantity of at least 1 are required." };
  }

  const supabase = await createClient();
  const { data: req } = await supabase
    .from("requisitions")
    .select("customer_id")
    .eq("id", requisitionId)
    .maybeSingle();
  if (!req) return { ok: false, error: "Requisition not found." };

  const { data: last } = await supabase
    .from("requisition_lines")
    .select("line_number")
    .eq("requisition_id", requisitionId)
    .order("line_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("requisition_lines").insert({
    requisition_id: requisitionId,
    customer_id: req.customer_id, // pinned to the parent by trigger anyway
    line_number: (last?.line_number ?? 0) + 1,
    craft_id: craftId,
    level_id: levelId,
    quantity,
    bill_rate: num(form.get("bill_rate")),
    target_pay_rate: num(form.get("target_pay_rate")),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/agency/requisitions/${requisitionId}`);
  return { ok: true };
}

export async function updateRequisitionLine(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  const requisitionId = nz(form.get("requisition_id"));
  if (!id) return { ok: false, error: "Missing line." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("requisition_lines")
    .update({
      quantity: num(form.get("quantity")) ?? 1,
      bill_rate: num(form.get("bill_rate")),
      target_pay_rate: num(form.get("target_pay_rate")),
      notes: nz(form.get("notes")),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  if (requisitionId) revalidatePath(`/agency/requisitions/${requisitionId}`);
  return { ok: true };
}

// =====================================================================
// Workers
// =====================================================================

/**
 * TWIC is recorded as a credential rather than a column on workers.
 *
 * worker_credentials already exists for exactly this, and going through it
 * means the card gets an expiry, a document and a verification state later
 * without moving the data. A boolean on workers would have to be migrated the
 * first time someone asks when a card runs out — and TWIC cards run out every
 * five years.
 *
 * Read the row first rather than upserting. The unique index on
 * worker_credentials is on `(worker_id, credential_id, coalesce(state_code, ''))`
 * — an expression — and ON CONFLICT can only name a constraint that matches
 * exactly, so an upsert on those three column names has nothing to conflict
 * against and errors out.
 *
 * Returns an error message, or null. It used to return nothing and discard
 * every error, which is how the broken upsert went unnoticed: the tick was
 * accepted, the save reported success, and no credential was written.
 */
async function setWorkerTwic(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workerId: string,
  hasTwic: boolean,
  verifiedBy: string,
): Promise<string | null> {
  const { data: twic, error: lookupError } = await supabase
    .from("credentials")
    .select("id")
    .eq("code", "TWIC")
    .is("customer_id", null)
    .maybeSingle();

  if (lookupError) return lookupError.message;
  if (!twic) {
    return "The TWIC credential is missing from the catalogue — run supabase/seed.sql.";
  }

  const { data: existing, error: readError } = await supabase
    .from("worker_credentials")
    .select("id")
    .eq("worker_id", workerId)
    .eq("credential_id", twic.id)
    .limit(1)
    .maybeSingle();

  if (readError) return readError.message;

  if (hasTwic) {
    const card = {
      state: "verified",
      verified_by: verifiedBy,
      verified_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase
          .from("worker_credentials")
          .update(card)
          .eq("id", existing.id)
      : await supabase.from("worker_credentials").insert({
          worker_id: workerId,
          credential_id: twic.id,
          ...card,
        });
    if (error) return error.message;
  } else if (existing) {
    const { error } = await supabase
      .from("worker_credentials")
      .delete()
      .eq("worker_id", workerId)
      .eq("credential_id", twic.id);
    if (error) return error.message;
  }

  return null;
}

export async function createWorker(form: FormData): Promise<Result<string>> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const first = nz(form.get("first_name"));
  const last = nz(form.get("last_name"));
  if (!first || !last) {
    return { ok: false, error: "First and last name are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workers")
    .insert({
      first_name: first,
      last_name: last,
      preferred_name: nz(form.get("preferred_name")),
      email: nz(form.get("email")),
      phone: nz(form.get("phone")),
      // The roster no longer asks for a status — anyone added here is someone
      // we could place today, so they go straight in as available.
      status: "available",
      primary_craft_id: nz(form.get("primary_craft_id")),
      primary_level_id: nz(form.get("primary_level_id")),
      notes: nz(form.get("notes")),
      created_by: guard.profile.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const twicError = await setWorkerTwic(
    supabase,
    data.id,
    bool(form.get("has_twic")),
    guard.profile.id,
  );

  revalidatePath("/agency/workers");

  // The worker exists either way, so say precisely that — reporting a plain
  // failure would suggest nothing was added and invite a duplicate.
  if (twicError) {
    return {
      ok: false,
      error: `${first} ${last} was added, but the TWIC was not recorded: ${twicError}`,
    };
  }

  return { ok: true, data: data.id };
}

export async function updateWorker(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  if (!id) return { ok: false, error: "Missing worker." };

  const first = nz(form.get("first_name"));
  const last = nz(form.get("last_name"));
  if (!first || !last) {
    return { ok: false, error: "First and last name are required." };
  }

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("workers")
    .select("status")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!current) return { ok: false, error: "Worker not found." };

  const { error } = await supabase
    .from("workers")
    .update({
      first_name: first,
      last_name: last,
      email: nz(form.get("email")),
      phone: nz(form.get("phone")),
      primary_craft_id: nz(form.get("primary_craft_id")),
      primary_level_id: nz(form.get("primary_level_id")),
      status: nextWorkerStatus(current.status, bool(form.get("is_active"))),
      notes: nz(form.get("notes")),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  const twicError = await setWorkerTwic(
    supabase,
    id,
    bool(form.get("has_twic")),
    guard.profile.id,
  );

  revalidatePath("/agency/workers");

  if (twicError) {
    return {
      ok: false,
      error: `Details saved, but the TWIC was not recorded: ${twicError}`,
    };
  }

  return { ok: true };
}

/**
 * The roster asks one question — are they active — but the column underneath
 * holds six values, and most of them are still wanted.
 *
 * Turning someone off always means 'inactive'. Turning them back on means
 * 'available' only if they were switched off; someone already assigned or on a
 * shortlist keeps the more specific status rather than being flattened to
 * available every time their phone number is corrected.
 */
function nextWorkerStatus(current: string, active: boolean): string {
  if (!active) return "inactive";
  return current === "inactive" ? "available" : current;
}

/**
 * Remove a worker from the roster.
 *
 * Hard delete where it is safe, soft delete where it is not. placements.worker_id
 * has no ON DELETE clause, so anyone who has ever been put against a line cannot
 * be removed outright without taking that history with them — and a placement
 * record is what proves who was on site and when. Those are marked deleted
 * instead, which takes them off every list the same way.
 */
export async function deleteWorker(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  if (!id) return { ok: false, error: "Missing worker." };

  const supabase = await createClient();

  const { count } = await supabase
    .from("placements")
    .select("id", { count: "exact", head: true })
    .eq("worker_id", id);

  if (count && count > 0) {
    const { error } = await supabase
      .from("workers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("workers").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/agency/workers");
  return { ok: true };
}

// =====================================================================
// Placements — the pipeline
// =====================================================================

/**
 * Put a worker against a line. Starts at 'identified', which is internal only:
 * the customer sees nothing until the placement reaches submitted_to_customer.
 */
export async function addPlacement(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const lineId = nz(form.get("requisition_line_id"));
  const workerId = nz(form.get("worker_id"));
  if (!lineId || !workerId) {
    return { ok: false, error: "Choose a worker." };
  }

  const supabase = await createClient();
  const { data: line } = await supabase
    .from("requisition_lines")
    .select("requisition_id, customer_id, start_date")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) return { ok: false, error: "Line not found." };

  // Default the start to the line's own date, or the request's. Crews rarely
  // all start on the same day, but the request date is the right first guess —
  // it is then changed per worker where it differs.
  const { data: req } = await supabase
    .from("requisitions")
    .select("start_date")
    .eq("id", line.requisition_id)
    .maybeSingle();

  const { error } = await supabase.from("placements").insert({
    requisition_line_id: lineId,
    requisition_id: line.requisition_id,
    customer_id: line.customer_id,
    worker_id: workerId,
    stage: "identified",
    scheduled_start_date:
      nz(form.get("scheduled_start_date")) ?? line.start_date ?? req?.start_date ?? null,
    created_by: guard.profile.id,
  });

  if (error) {
    return {
      ok: false,
      error: error.message.includes("duplicate")
        ? "That worker is already on this line."
        : error.message,
    };
  }

  revalidatePath(`/agency/requisitions/${line.requisition_id}`);
  return { ok: true };
}

/**
 * Move a placement to a new stage.
 *
 * The database decides customer visibility from the stage (trg_placement_stage)
 * and logs the transition to placement_events, so this only has to set the
 * stage and any dates that go with it.
 */
/**
 * Update one worker's placement: stage, and the dates that belong to them
 * rather than to the request.
 *
 * Start dates are per worker on purpose — a crew of twelve rarely all walks
 * through the gate on the same morning, and the customer needs to see who is
 * actually expected when.
 */
export async function setPlacementStage(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  const stage = nz(form.get("stage"));
  const requisitionId = nz(form.get("requisition_id"));
  if (!id || !stage) return { ok: false, error: "Missing placement or stage." };

  const scheduledStart = nz(form.get("scheduled_start_date"));
  const scheduledEnd = nz(form.get("scheduled_end_date"));
  if (scheduledStart && scheduledEnd && scheduledEnd < scheduledStart) {
    return { ok: false, error: "That end date is before the start date." };
  }

  const patch: Record<string, unknown> = {
    stage,
    scheduled_start_date: scheduledStart,
    scheduled_end_date: scheduledEnd,
  };
  if (stage === "started") patch.actual_start_date = new Date().toISOString().slice(0, 10);
  if (stage === "completed" || stage === "ended_early") {
    patch.actual_end_date = new Date().toISOString().slice(0, 10);
    patch.end_reason = nz(form.get("end_reason"));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("placements").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (requisitionId) revalidatePath(`/agency/requisitions/${requisitionId}`);
  revalidatePath("/agency");
  return { ok: true };
}

export async function removePlacement(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  const requisitionId = nz(form.get("requisition_id"));
  if (!id) return { ok: false, error: "Missing placement." };

  const supabase = await createClient();
  const { error } = await supabase.from("placements").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (requisitionId) revalidatePath(`/agency/requisitions/${requisitionId}`);
  return { ok: true };
}

/**
 * Delete a requisition outright.
 *
 * Cancelling is the normal path — it keeps the record and tells the customer
 * why. Deletion is for mistakes and test data, and it takes the lines,
 * placements, requirements and comments with it by cascade.
 */
export async function deleteRequisition(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  if (!id) return { ok: false, error: "Missing requisition." };

  const supabase = await createClient();
  const { error } = await supabase.from("requisitions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/agency");
  revalidatePath("/");
  return { ok: true };
}
