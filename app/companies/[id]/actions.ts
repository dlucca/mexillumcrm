"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { archiveCompany, restoreCompany } from "@/db/companies";
import { runUpdateCompany, type ActionResult } from "@/lib/company-mutations";

export async function updateCompanyAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const result = await runUpdateCompany(db, formData);
  if (result.ok) {
    const id = formData.get("id");
    revalidatePath("/companies");
    if (typeof id === "string" && id.length > 0) {
      revalidatePath(`/companies/${id}`);
    }
  }
  return result;
}

export async function archiveCompanyAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id === "string" && id.length > 0) {
    await archiveCompany(db, id);
    revalidatePath("/companies");
  }
  redirect("/companies");
}

export async function restoreCompanyAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id === "string" && id.length > 0) {
    await restoreCompany(db, id);
    revalidatePath("/companies");
  }
  redirect("/companies");
}
