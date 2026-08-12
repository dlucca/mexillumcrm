"use client";

import {
  archiveProjectAction,
  restoreProjectAction,
} from "@/app/projects/actions";

export function ProjectArchiveButton({
  id,
  archived,
}: {
  id: string;
  archived: boolean;
}) {
  return (
    <form
      action={archived ? restoreProjectAction : archiveProjectAction}
      onSubmit={(e) => {
        if (!archived && !window.confirm("¿Archivar este proyecto?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="font-semibold text-sm underline">
        {archived ? "Restaurar" : "Archivar"}
      </button>
    </form>
  );
}
