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
      status: nz(form.get("status")) ?? "candidate",
      home_city: nz(form.get("home_city")),
      home_state: nz(form.get("home_state")),
      primary_craft_id: nz(form.get("primary_craft_id")),
      primary_level_id: nz(form.get("primary_level_id")),
      years_experience: num(form.get("years_experience")),
      notes: nz(form.get("notes")),
      created_by: guard.profile.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/agency/workers");
  return { ok: true, data: data.id };
}

export async function updateWorker(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const id = nz(form.get("id"));
  if (!id) return { ok: false, error: "Missing worker." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("workers")
    .update({
      first_name: nz(form.get("first_name")),
      last_name: nz(form.get("last_name")),
      email: nz(form.get("email")),
      phone: nz(form.get("phone")),
      status: nz(form.get("status")) ?? "candidate",
      home_city: nz(form.get("home_city")),
      home_state: nz(form.get("home_state")),
      primary_craft_id: nz(form.get("primary_craft_id")),
      primary_level_id: nz(form.get("primary_level_id")),
      years_experience: num(form.get("years_experience")),
      notes: nz(form.get("notes")),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
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
