import { z } from "zod";

export const companyCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
});

export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;
