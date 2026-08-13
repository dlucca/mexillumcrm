import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getProject } from "@/db/projects";
import { getCompany } from "@/db/companies";
import { listContacts } from "@/db/contacts";
import { listActivitiesForProject } from "@/db/activities";
import { listTasksForProject } from "@/db/tasks";
import { ACTIVITY_TYPE_VALUES } from "@/lib/activity-log";
import { nextActionTask } from "@/lib/tasks";
import { todayInMexicoCity } from "@/lib/my-actions";
import { DetailHeader } from "@/components/project-detail/detail-header";
import { NextActionCard, ContactsCard, DetailsCard } from "@/components/project-detail/rail-cards";
import { ProjectDetailForm } from "@/components/project-detail-form";
import { ProjectArchiveButton } from "@/components/project-archive-button";
import { NewNoteForm } from "@/components/new-note-form";
import { NewTaskForm } from "@/components/new-task-form";
import { TaskList } from "@/components/task-list";
import { ActivityFilter } from "@/components/activity-filter";
import { ActivityTimeline } from "@/components/activity-timeline";

export const dynamic = "force-dynamic";

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-surface p-5">{children}</section>;
}

function PanelHead({ title, meta, right }: { title: string; meta?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <h2 className="font-display text-[1.2rem] font-bold tracking-display">{title}</h2>
      {meta ? <span className="font-mono text-[0.66rem] text-faint">{meta}</span> : null}
      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ activityType?: string | string[] }>;
}) {
  const { id } = await params;
  const { activityType } = await searchParams;
  const project = await getProject(db, id);
  if (!project) notFound();

  const rawType = Array.isArray(activityType) ? activityType[0] : activityType;
  const type = rawType && ACTIVITY_TYPE_VALUES.includes(rawType) ? rawType : undefined;

  const company = await getCompany(db, project.companyId);
  const contacts = await listContacts(db, project.companyId);
  const allActivities = await listActivitiesForProject(db, id);
  const tasks = await listTasksForProject(db, id);
  const today = todayInMexicoCity();

  const archived = project.archivedAt !== null;
  const timeline = type ? allActivities.filter((a) => a.type === type) : allActivities;
  const lastActivityAt = allActivities[0]?.occurredAt ?? null;
  const nextAction = nextActionTask(tasks);
  const openTaskCount = tasks.filter((t) => t.completedAt == null).length;
  const principal = contacts[0] ? { name: contacts[0].name, role: contacts[0].role } : null;
  const companyName = company?.name ?? "Empresa";

  return (
    <main className="flex min-w-0 flex-col">
      <DetailHeader
        project={project}
        companyName={companyName}
        principalContact={principal}
        actions={<ProjectArchiveButton id={project.id} archived={archived} />}
      />

      {archived ? (
        <p className="border-b border-line bg-danger-wash px-5 py-2 text-sm text-danger-ink md:px-8">
          Este proyecto está archivado.
        </p>
      ) : null}

      <div className="grid items-start gap-6 px-5 py-6 md:px-8 lg:grid-cols-[1fr_336px]">
        {/* MAIN */}
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelHead title="Actividad" meta={`${allActivities.length} registros`} right={<ActivityFilter />} />
            {!archived ? <NewNoteForm projectId={project.id} /> : null}
            <div className="mt-3">
              <ActivityTimeline activities={timeline} />
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Tareas" meta={openTaskCount > 0 ? `${openTaskCount} abiertas` : undefined} />
            {!archived ? <NewTaskForm projectId={project.id} /> : null}
            <TaskList tasks={tasks} projectId={project.id} archived={archived} />
          </Panel>

          <details className="group rounded-2xl border border-line bg-surface">
            <summary className="cursor-pointer list-none px-5 py-4 font-display text-[1.2rem] font-bold tracking-display marker:hidden">
              Editar proyecto
              <span className="ml-2 text-sm font-normal text-muted group-open:hidden">▾</span>
              <span className="ml-2 hidden text-sm font-normal text-muted group-open:inline">▴</span>
            </summary>
            <div className="border-t border-line px-5 pb-5 pt-4">
              <ProjectDetailForm project={project} />
            </div>
          </details>
        </div>

        {/* RAIL */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <NextActionCard task={nextAction} projectId={project.id} today={today} archived={archived} />
          <ContactsCard contacts={contacts} companyId={project.companyId} />
          <DetailsCard project={project} companyName={companyName} lastActivityAt={lastActivityAt} />
        </aside>
      </div>
    </main>
  );
}
