"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { archiveContact, restoreContact } from "@/db/contacts";
import { runCreateContact, runUpdateContact } from "@/lib/contact-mutations";
import type { ActionResult } from "@/lib/company-mutations";

const idSchema = z.string().uuid();

export async function createContactAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const result = await runCreateContact(db, formData);
  if (result.ok) {
    const companyId = idSchema.safeParse(formData.get("companyId"));
    if (companyId.success) revalidatePath(`/companies/${companyId.data}`);
  }
  return result;
}

export async function updateContactAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const result = await runUpdateContact(db, formData);
  if (result.ok) {
    const companyId = idSchema.safeParse(formData.get("companyId"));
    if (companyId.success) revalidatePath(`/companies/${companyId.data}`);
  }
  return result;
}

export async function archiveContactAction(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"));
  const companyId = idSchema.safeParse(formData.get("companyId"));
  if (id.success) await archiveContact(db, id.data);
  const target = companyId.success ? `/companies/${companyId.data}` : "/companies";
  revalidatePath(target);
  redirect(target);
}

export async function restoreContactAction(formData: FormData): Promise<void> {
  const id = idSchema.safeParse(formData.get("id"));
  const companyId = idSchema.safeParse(formData.get("companyId"));
  if (id.success) await restoreContact(db, id.data);
  const target = companyId.success ? `/companies/${companyId.data}` : "/companies";
  revalidatePath(target);
  redirect(target);
}
