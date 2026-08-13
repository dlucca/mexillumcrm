import { db } from "@/db/client";
import { listCompanies } from "@/db/companies";
import { ProjectCreateForm } from "@/components/projects/project-create-form";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company } = await searchParams;
  const companies = await listCompanies(db);
  return (
    <ProjectCreateForm
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      preselectedCompanyId={company}
    />
  );
}
