"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { createCompany } from "@/db/companies";
import { companyCreateSchema } from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCompanyAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = companyCreateSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await createCompany(db, parsed.data);
  } catch {
    return { ok: false, error: "No se pudo crear la empresa" };
  }

  revalidatePath("/companies");
  return { ok: true };
}
