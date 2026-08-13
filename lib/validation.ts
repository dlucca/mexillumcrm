import { z } from "zod";
import { STAGE_VALUES, STATUS_VALUES, SOLUTION_TYPE_VALUES, SOURCE_VALUES, LOST_REASON_VALUES } from "@/lib/project-pipeline";

export const companyCreateSchema = z.object({
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "El nombre es obligatorio")
  ),
});

export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;

export const optionalText = z.preprocess((v) => {
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

export const contactCreateSchema = z.object({
  companyId: z.string().uuid("Empresa inválida"),
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "El nombre es obligatorio")
  ),
  email: optionalText,
  phone: optionalText,
  role: optionalText,
  notes: optionalText,
});

export type ContactCreateInput = z.infer<typeof contactCreateSchema>;

export const contactUpdateSchema = z.object({
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "El nombre es obligatorio")
  ),
  email: optionalText,
  phone: optionalText,
  role: optionalText,
  notes: optionalText,
});

export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;

function requiredEnum(values: string[], message: string, fallback?: string) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : fallback ?? v),
    z.string().refine((val) => values.includes(val), { message })
  );
}

function optionalEnum(values: string[], message: string) {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
    z.string().refine((val) => values.includes(val), { message }).nullable()
  );
}

function optionalInt(opts: { max?: number } = {}) {
  const base = opts.max === undefined
    ? z.number().int().min(0)
    : z.number().int().min(0).max(opts.max);
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : null),
    base.nullable()
  );
}

const optionalDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").nullable()
);

export const projectCreateSchema = z.object({
  companyId: z.string().uuid("Empresa inválida"),
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "El nombre es obligatorio")
  ),
  stage: requiredEnum(STAGE_VALUES, "Etapa inválida", "lead_sin_contactar"),
  solutionType: requiredEnum(SOLUTION_TYPE_VALUES, "Solución inválida", "unknown"),
  estimatedValue: optionalInt(),
  notes: optionalText,
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = z
  .object({
    name: z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : ""),
      z.string().min(1, "El nombre es obligatorio")
    ),
    plantName: optionalText,
    locationAddress: optionalText,
    city: optionalText,
    state: optionalText,
    country: optionalText,
    industrySubsegment: optionalText,
    stage: requiredEnum(STAGE_VALUES, "Etapa inválida"),
    status: requiredEnum(STATUS_VALUES, "Status inválido"),
    solutionType: requiredEnum(SOLUTION_TYPE_VALUES, "Solución inválida"),
    estimatedValue: optionalInt(),
    probability: optionalInt({ max: 100 }),
    expectedCloseDate: optionalDate,
    source: optionalEnum(SOURCE_VALUES, "Fuente inválida"),
    lostReason: optionalEnum(LOST_REASON_VALUES, "Motivo inválido"),
    lostReasonNote: optionalText,
    notes: optionalText,
  })
  .refine((d) => d.status !== "lost" || d.lostReason != null, {
    message: "Falta el motivo de pérdida",
    path: ["lostReason"],
  });

export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

export const noteCreateSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  body: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "La nota no puede estar vacía")
  ),
});

export type NoteCreateInput = z.infer<typeof noteCreateSchema>;

const requiredDate = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : ""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
);

export const taskCreateSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  title: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "El título es obligatorio")
  ),
  dueDate: requiredDate,
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

export const stageMoveSchema = z.object({
  projectId: z.string().uuid("Proyecto inválido"),
  stage: requiredEnum(STAGE_VALUES, "Etapa inválida"),
});

export type StageMoveInput = z.infer<typeof stageMoveSchema>;
