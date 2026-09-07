"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { assertAgency } from "@/lib/auth";
import { PREVIEW_COOKIE } from "@/lib/preview";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Choose which customer's portal to preview, or clear the choice.
 *
 * Agency only — a customer user is scoped by RLS and has nothing to switch.
 */
export async function setPreviewCustomer(form: FormData): Promise<Result> {
  const guard = await assertAgency();
  if (!guard.ok) return guard;

  const value = form.get("customer_id");
  const id = typeof value === "string" ? value.trim() : "";
  const jar = await cookies();

  if (id === "") {
    jar.delete(PREVIEW_COOKIE);
  } else {
    jar.set(PREVIEW_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
