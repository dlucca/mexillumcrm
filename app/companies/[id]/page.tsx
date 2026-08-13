import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getCompany } from "@/db/companies";
import { listContacts } from "@/db/contacts";
import { listProjects } from "@/db/projects";
import { listActivitiesForCompany } from "@/db/activities";
import { listOpenTasksWithContext } from "@/db/tasks";
import { nextActionByProject } from "@/lib/pipeline";
import { summarizeCompanyProjects } from "@/lib/companies";
import { solutionMix } from "@/lib/dashboard";
import { todayInMexicoCity } from "@/lib/my-actions";
import { labelOf, STAGE_GROUPS } from "@/lib/project-pipeline";
import { formatDateTime } from "@/lib/activity-log";
import { CompanyDetailHeader } from "@/components/company-detail/detail-header";
import { CompanyProjects } from "@/components/company-detail/company-projects";
import { CompanyDetailsCard, CompanyContactsCard } from "@/components/company-detail/rail-cards";
import { SolutionMixPanel } from "@/components/dashboard/solution-mix-panel";
import { ActivityTimeline } from "@/components/activity-timeline";
import { CompanyDetailForm } from "@/components/company-detail-form";
import { CompanyArchiveButton } from "@/components/company-archive-button";
import { NewContactForm } from "@/components/new-contact-form";
import { ContactTable } from "@/components/contact-table";

export const dynamic = "force-dynamic";

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-surface p-5">{children}</section>;
}

function PanelHead({ title, meta, right }: { title: string; meta?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex items-center gap-2.5">
      <h2 className="font-display text-[1.2rem] font-bold tracking-display">{title}</h2>
      {meta ? <span className="font-mono text-[0.66rem] text-faint">{meta}</span> : null}
      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-line bg-surface">
      <summary className="cursor-pointer list-none px-5 py-4 font-display text-[1.2rem] font-bold tracking-display marker:hidden">
        {title}
        <span className="ml-2 text-sm font-normal text-muted group-open:hidden">▾</span>
        <span className="ml-2 hidden text-sm font-normal text-muted group-open:inline">▴</span>
      </summary>
      <div className="border-t border-line px-5 pb-5 pt-4">{children}</div>
    </details>
  );
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ contactsArchived?: string }>;
}) {
  const { id } = await params;
  const { contactsArchived } = await searchParams;
  const company = await getCompany(db, id);
  if (!company) notFound();

  const archived = company.archivedAt !== null;
  const showArchivedContacts = contactsArchived === "1";

  const projects = await listProjects(db, company.id, { archived: false });
  const contacts = await listContacts(db, company.id, { archived: showArchivedContacts });
  const activeContacts = showArchivedContacts ? await listContacts(db, company.id) : contacts;
  const activities = await listActivitiesForCompany(db, company.id);
  const openTasks = await listOpenTasksWithContext(db);
  const today = todayInMexicoCity();

  const summary = summarizeCompanyProjects(projects);
  const mix = solutionMix(projects);
  const nextAction = nextActionByProject(openTasks);
  const lastActivityAt = activities[0]?.occurredAt ? formatDateTime(activities[0].occurredAt) : null;

  const countByGroup = new Map<string, number>();
  for (const p of projects) countByGroup.set(p.stageGroup, (countByGroup.get(p.stageGroup) ?? 0) + 1);
  const projectsSub = summary.groups
    .map((g) => `${countByGroup.get(g)} ${labelOf(STAGE_GROUPS, g).toLowerCase()}`)
    .join(" · ");

  return (
    <main className="flex min-w-0 flex-col">
      <CompanyDetailHeader
        company={company}
        status={summary.status}
        totalValue={summary.totalValue}
        count={summary.count}
        projectsSub={projectsSub}
        contactCount={activeContacts.length}
        lastActivityAt={lastActivityAt}
        actions={
          <>
            <Link
              href={`/projects/new?company=${company.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-solar px-3.5 py-2.5 text-sm font-semibold text-on-solar transition-colors hover:bg-solar-strong"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 2v10M2 7h10" />
              </svg>
              Nuevo proyecto
            </Link>
            <CompanyArchiveButton id={company.id} archived={archived} />
          </>
        }
      />

      {archived ? (
        <p className="border-b border-line bg-danger-wash px-5 py-2 text-sm text-danger-ink md:px-8">
          Esta empresa está archivada.
        </p>
      ) : null}

      <div className="grid items-start gap-6 px-5 py-6 md:px-8 lg:grid-cols-[1fr_336px]">
        {/* MAIN */}
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelHead
              title="Proyectos · plantas"
              meta={summary.count === 1 ? "1 ubicación" : `${summary.count} ubicaciones`}
              right={
                <Link href={`/projects/new?company=${company.id}`} className="text-sm font-semibold text-solar-ink hover:underline">
                  ＋ Nuevo proyecto
                </Link>
              }
            />
            <CompanyProjects projects={projects} nextAction={nextAction} today={today} />
          </Panel>

          <Panel>
            <PanelHead title="Actividad de la cuenta" meta={`${activities.length} registros`} />
            <ActivityTimeline activities={activities} />
          </Panel>

          <Collapsible title="Editar empresa">
            <CompanyDetailForm company={company} />
          </Collapsible>

          <Collapsible title="Gestionar contactos">
            <div className="mb-3 flex gap-4 text-sm">
              <Link href={`/companies/${company.id}`} className={showArchivedContacts ? "text-muted hover:text-ink" : "font-semibold"}>
                Activos
              </Link>
              <Link
                href={`/companies/${company.id}?contactsArchived=1`}
                className={showArchivedContacts ? "font-semibold" : "text-muted hover:text-ink"}
              >
                Archivados
              </Link>
            </div>
            {!showArchivedContacts ? <NewContactForm companyId={company.id} /> : null}
            <ContactTable data={contacts} archived={showArchivedContacts} />
          </Collapsible>
        </div>

        {/* RAIL */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <CompanyDetailsCard company={company} />
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="col-label mb-2 text-[0.72rem] text-muted">Valor por solución</div>
            <SolutionMixPanel rows={mix} />
          </div>
          <CompanyContactsCard contacts={activeContacts} />
        </aside>
      </div>
    </main>
  );
}
