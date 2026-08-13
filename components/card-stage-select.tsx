"use client";

import { useRouter } from "next/navigation";
import { STAGES, STAGE_GROUPS, stageGroupFor } from "@/lib/project-pipeline";
import { moveStageAction } from "@/app/projects/actions";

export function CardStageSelect({ projectId, stage }: { projectId: string; stage: string }) {
  const router = useRouter();

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStage = e.target.value;
    if (newStage === stage) return;
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("stage", newStage);
    await moveStageAction(fd);
    router.refresh();
  }

  return (
    <select
      defaultValue={stage}
      onChange={onChange}
      className="w-full rounded-md border px-2 py-1 text-xs"
    >
      {STAGE_GROUPS.map((g) => (
        <optgroup key={g.value} label={g.label}>
          {STAGES.filter((s) => stageGroupFor(s.value) === g.value).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
