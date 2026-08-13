import Link from "next/link";
import type { ProjectListRow } from "@/db/projects";
import { labelOf, formatMXN, SOLUTION_TYPES, STATUSES } from "@/lib/project-pipeline";
import { CardStageSelect } from "@/components/card-stage-select";

export function ProjectCard({
  project,
  nextActionTitle,
}: {
  project: ProjectListRow;
  nextActionTitle: string | null;
}) {
  return (
    <div className="rounded-md border bg-white p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/projects/${project.id}`} className="font-medium underline">
          {project.name}
        </Link>
        {project.status !== "open" && (
          <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
            {labelOf(STATUSES, project.status)}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {project.companyName}
        {project.plantName ? ` · ${project.plantName}` : ""}
      </p>
      <p className="text-xs text-neutral-500">
        {labelOf(SOLUTION_TYPES, project.solutionType)} · {formatMXN(project.estimatedValue)}
      </p>
      <p className="mt-1 text-xs">
        {nextActionTitle ? `▸ ${nextActionTitle}` : "sin próxima acción"}
      </p>
      <div className="mt-2">
        <CardStageSelect projectId={project.id} stage={project.stage} />
      </div>
    </div>
  );
}
