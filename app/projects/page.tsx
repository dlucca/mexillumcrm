import Link from "next/link";
import { db } from "@/db/client";
import { listAllProjects } from "@/db/projects";
import { ProjectTable } from "@/components/project-table";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const projects = await listAllProjects(db, { archived: showArchived });

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-4xl tracking-display">Proyectos</h1>
        <Link href="/companies" className="text-sm underline">
          Empresas
        </Link>
      </div>

      <div className="mt-6 flex gap-4 text-sm">
        <Link href="/projects" className={showArchived ? "underline" : "font-semibold"}>
          Activos
        </Link>
        <Link
          href="/projects?archived=1"
          className={showArchived ? "font-semibold" : "underline"}
        >
          Archivados
        </Link>
      </div>

      <ProjectTable data={projects} archived={showArchived} showCompany />
    </main>
  );
}
