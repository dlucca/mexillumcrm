import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getProject } from "@/db/projects";
import { getCompany } from "@/db/companies";
import { listActivitiesForProject } from "@/db/activities";
import { ProjectDetailForm } from "@/components/project-detail-form";
import { ProjectArchiveButton } from "@/components/project-archive-button";
import { NewNoteForm } from "@/components/new-note-form";
import { ActivityFilter } from "@/components/activity-filter";
import { ActivityTimeline } from "@/components/activity-timeline";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ activityType?: string }>;
}) {
  const { id } = await params;
  const { activityType } = await searchParams;
  const project = await getProject(db, id);
  if (!project) notFound();

  const company = await getCompany(db, project.companyId);
  const archived = project.archivedAt !== null;
  const activities = await listActivitiesForProject(db, id, { type: activityType });

  return (
    <main className="mx-auto max-w-4xl p-8">
      <Link href={`/companies/${project.companyId}`} className="text-sm underline">
        ← {company?.name ?? "Empresa"}
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display font-bold text-4xl tracking-display">{project.name}</h1>
        <ProjectArchiveButton id={project.id} archived={archived} />
      </div>
      {archived && (
        <p className="mt-2 text-sm text-neutral-500">Este proyecto está archivado.</p>
      )}
      <ProjectDetailForm project={project} />

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-2xl tracking-display">Actividad</h2>
          <ActivityFilter />
        </div>
        {!archived && <NewNoteForm projectId={project.id} />}
        <ActivityTimeline activities={activities} />
      </section>
    </main>
  );
}
