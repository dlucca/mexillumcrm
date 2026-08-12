import type { AnyDb } from "@/db/types";
import { createCompany, updateCompany } from "@/db/companies";
import { companyCreateSchema, companyUpdateSchema } from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function runCreateCompany(
  db: AnyDb,
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
  return { ok: true };
}

export async function runUpdateCompany(
  db: AnyDb,
  formData: FormData
): Promise<ActionResult> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Falta el identificador de la empresa" };
  }
  const parsed = companyUpdateSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName"),
    industry: formData.get("industry"),
    companyType: formData.get("companyType"),
    website: formData.get("website"),
    taxId: formData.get("taxId"),
    headquartersLocation: formData.get("headquartersLocation"),
    sizeSegment: formData.get("sizeSegment"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await updateCompany(db, id, parsed.data);
  } catch {
    return { ok: false, error: "No se pudo actualizar la empresa" };
  }
  return { ok: true };
}
