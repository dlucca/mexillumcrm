"use client";

import {
  archiveCompanyAction,
  restoreCompanyAction,
} from "@/app/companies/[id]/actions";

export function CompanyArchiveButton({
  id,
  archived,
}: {
  id: string;
  archived: boolean;
}) {
  return (
    <form
      action={archived ? restoreCompanyAction : archiveCompanyAction}
      onSubmit={(e) => {
        if (!archived && !window.confirm("¿Archivar esta empresa?")) {
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
