import type { AnyDb } from "@/db/types";
import { createContact, updateContact } from "@/db/contacts";
import { contactCreateSchema, contactUpdateSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/company-mutations";

export async function runCreateContact(
  db: AnyDb,
  formData: FormData
): Promise<ActionResult> {
  const parsed = contactCreateSchema.safeParse({
    companyId: formData.get("companyId"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    role: formData.get("role"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await createContact(db, parsed.data);
  } catch {
    return { ok: false, error: "No se pudo crear el contacto" };
  }
  return { ok: true };
}

export async function runUpdateContact(
  db: AnyDb,
  formData: FormData
): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Falta el identificador del contacto" };
  }
  const parsed = contactUpdateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    role: formData.get("role"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const row = await updateContact(db, id, parsed.data);
    if (!row) {
      return { ok: false, error: "No se encontró el contacto" };
    }
  } catch {
    return { ok: false, error: "No se pudo actualizar el contacto" };
  }
  return { ok: true };
}
