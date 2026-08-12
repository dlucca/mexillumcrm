"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { runCreateCompany, type ActionResult } from "@/lib/company-mutations";

export async function createCompanyAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const result = await runCreateCompany(db, formData);
  if (result.ok) revalidatePath("/companies");
  return result;
}
