import { z } from "zod";

export const companyCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
});

export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;

const optionalText = z.preprocess((v) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}, z.string().nullable());

export const companyUpdateSchema = z.object({
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "El nombre es obligatorio")
  ),
  legalName: optionalText,
  industry: optionalText,
  companyType: optionalText,
  website: optionalText,
  taxId: optionalText,
  headquartersLocation: optionalText,
  sizeSegment: optionalText,
  notes: optionalText,
});

export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;
