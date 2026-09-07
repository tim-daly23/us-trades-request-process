"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, RequisitionInput } from "@/lib/requisition-types";

/** "" -> null, so empty form fields do not become 0 or an invalid date. */
function nullable(value: string): string | null {
  const v = value.trim();
  return v === "" ? null : v;
}

function numberOrNull(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function createRequisition(
  input: RequisitionInput,
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // customer_id comes from the server-side profile, never from the client.
  // RLS would reject a foreign tenant anyway, but the value should not be
  // client-supplied in the first place.
  const { data: profile } = await supabase
    .from("app_users")
    .select("customer_id, customer_role, user_type")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.customer_id) {
    return {
      ok: false,
      error: "Only customer users can raise a request from this screen.",
    };
  }

  // --- validation ------------------------------------------------------
  if (!input.siteId) return { ok: false, error: "Choose a site." };
  if (!input.startDate) return { ok: false, error: "Choose a start date." };

  const lines = input.lines.filter(
    (l) => l.craftId && l.levelId && l.quantity > 0,
  );
  if (lines.length === 0) {
    return { ok: false, error: "Add at least one craft line." };
  }
  if (input.endDate && input.endDate < input.startDate) {
    return { ok: false, error: "End date cannot be before the start date." };
  }

  // A requester at a customer with internal approval switched on cannot send
  // straight to US Trades — it parks at pending_approval for an approver.
  const { data: customer } = await supabase
    .from("customers")
    .select("requires_internal_approval")
    .eq("id", profile.customer_id)
    .maybeSingle();

  const needsInternalApproval =
    customer?.requires_internal_approval === true &&
    profile.customer_role === "requester";

  const status = !input.submit
    ? "draft"
    : needsInternalApproval
      ? "pending_approval"
      : "submitted";

  // --- header ----------------------------------------------------------
  // req_number is omitted deliberately: trg_req_number generates it from the
  // customer slug and the per-year counter.
  const { data: req, error: reqError } = await supabase
    .from("requisitions")
    .insert({
      customer_id: profile.customer_id,
      site_id: input.siteId,
      title: nullable(input.title),
      project_name: nullable(input.projectName),
      po_number: nullable(input.poNumber),
      status,
      urgency: input.urgency,
      start_date: input.startDate,
      end_date: nullable(input.endDate),
      duration_weeks: numberOrNull(input.durationWeeks),
      shift: input.shift,
      hours_per_day: numberOrNull(input.hoursPerDay) ?? 10,
      days_per_week: numberOrNull(input.daysPerWeek) ?? 6,
      per_diem_rate: numberOrNull(input.perDiemRate),
      scope_of_work: nullable(input.scopeOfWork),
      special_instructions: nullable(input.specialInstructions),
      created_by: user.id,
      submitted_by: input.submit ? user.id : null,
      submitted_at: input.submit ? new Date().toISOString() : null,
    })
    .select("id, req_number, status")
    .single();

  if (reqError || !req) {
    return { ok: false, error: reqError?.message ?? "Could not save request." };
  }

  // --- lines -----------------------------------------------------------
  // customer_id is pinned to the parent by trigger; the value here only
  // satisfies NOT NULL.
  const { error: lineError } = await supabase.from("requisition_lines").insert(
    lines.map((l, i) => ({
      requisition_id: req.id,
      customer_id: profile.customer_id,
      line_number: i + 1,
      craft_id: l.craftId,
      level_id: l.levelId,
      quantity: l.quantity,
    })),
  );

  if (lineError) {
    // No transaction spans these calls, so a failure here would leave a header
    // with no lines. Remove it rather than stranding an empty requisition.
    await supabase.from("requisitions").delete().eq("id", req.id);
    return { ok: false, error: `Could not save craft lines: ${lineError.message}` };
  }

  // --- credential requirements ----------------------------------------
  if (input.credentialIds.length > 0) {
    const { error: credError } = await supabase
      .from("requisition_requirements")
      .insert(
        input.credentialIds.map((credential_id) => ({
          requisition_id: req.id,
          credential_id,
          is_required: true,
        })),
      );
    if (credError) {
      return {
        ok: false,
        error: `Request saved, but credentials failed: ${credError.message}`,
      };
    }
  }

  revalidatePath("/");
  return {
    ok: true,
    id: req.id,
    reqNumber: req.req_number,
    status: req.status,
  };
}
