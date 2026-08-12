import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getCompany } from "@/db/companies";
import { CompanyDetailForm } from "@/components/company-detail-form";
import { CompanyArchiveButton } from "@/components/company-archive-button";
import { listContacts } from "@/db/contacts";
import { NewContactForm } from "@/components/new-contact-form";
import { ContactTable } from "@/components/contact-table";
import { listProjects } from "@/db/projects";
import { NewProjectForm } from "@/components/new-project-form";
import { ProjectTable } from "@/components/project-table";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ contactsArchived?: string; projectsArchived?: string }>;
}) {
  const { id } = await params;
  const { contactsArchived, projectsArchived } = await searchParams;
  const company = await getCompany(db, id);
  if (!company) notFound();

  const archived = company.archivedAt !== null;
  const showArchivedContacts = contactsArchived === "1";
  const contactRows = await listContacts(db, company.id, {
    archived: showArchivedContacts,
  });

  const showArchivedProjects = projectsArchived === "1";
  const projectRows = await listProjects(db, company.id, {
    archived: showArchivedProjects,
  });

  return (
    <main className="mx-auto max-w-4xl p-8">
      <Link href="/companies" className="text-sm underline">
        ← Empresas
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display font-bold text-4xl tracking-display">
          {company.name}
        </h1>
        <CompanyArchiveButton id={company.id} archived={archived} />
      </div>
      {archived && (
        <p className="mt-2 text-sm text-neutral-500">Esta empresa está archivada.</p>
      )}
      <CompanyDetailForm company={company} />

      <section className="mt-12">
        <h2 className="font-display font-bold text-2xl tracking-display">Contactos</h2>
        <div className="mt-4 flex gap-4 text-sm">
          <Link
            href={`/companies/${company.id}`}
            className={showArchivedContacts ? "underline" : "font-semibold"}
          >
            Activos
          </Link>
          <Link
            href={`/companies/${company.id}?contactsArchived=1`}
            className={showArchivedContacts ? "font-semibold" : "underline"}
          >
            Archivados
          </Link>
        </div>
        {!showArchivedContacts && <NewContactForm companyId={company.id} />}
        <ContactTable data={contactRows} archived={showArchivedContacts} />
      </section>

      <section className="mt-12">
        <h2 className="font-display font-bold text-2xl tracking-display">Proyectos</h2>
        <div className="mt-4 flex gap-4 text-sm">
          <Link
            href={`/companies/${company.id}`}
            className={showArchivedProjects ? "underline" : "font-semibold"}
          >
            Activos
          </Link>
          <Link
            href={`/companies/${company.id}?projectsArchived=1`}
            className={showArchivedProjects ? "font-semibold" : "underline"}
          >
            Archivados
          </Link>
        </div>
        {!showArchivedProjects && <NewProjectForm companyId={company.id} />}
        <ProjectTable data={projectRows} archived={showArchivedProjects} />
      </section>
    </main>
  );
}
