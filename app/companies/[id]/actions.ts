"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { archiveCompany, restoreCompany } from "@/db/companies";
import { runUpdateCompany, runDeleteCompany, type ActionResult } from "@/lib/company-mutations";

const idSchema = z.string().uuid();

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
  const parsedId = idSchema.safeParse(formData.get("id"));
  if (parsedId.success) {
    await archiveCompany(db, parsedId.data);
    revalidatePath("/companies");
  }
  redirect("/companies");
}

export async function restoreCompanyAction(formData: FormData): Promise<void> {
  const parsedId = idSchema.safeParse(formData.get("id"));
  if (parsedId.success) {
    await restoreCompany(db, parsedId.data);
    revalidatePath("/companies");
  }
  redirect("/companies");
}

export async function deleteCompanyAction(formData: FormData): Promise<void> {
  const parsedId = idSchema.safeParse(formData.get("id"));
  if (parsedId.success) {
    await runDeleteCompany(db, parsedId.data);
    revalidatePath("/companies");
    revalidatePath("/dashboard");
    revalidatePath("/pipeline");
  }
}
