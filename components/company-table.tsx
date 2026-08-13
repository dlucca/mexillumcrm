"use client";

import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { CompanyListRow } from "@/db/companies";
import { restoreCompanyAction, deleteCompanyAction } from "@/app/companies/[id]/actions";
import { DeleteEntityDialog } from "@/components/delete-entity-dialog";

const columnHelper = createColumnHelper<CompanyListRow>();

function companyDeleteDescription(c: CompanyListRow): string {
  const proyectos = c.projectCount === 1 ? "1 proyecto" : `${c.projectCount} proyectos`;
  return `Se eliminará permanentemente «${c.name}» y sus ${proyectos}, con sus contactos, actividades y tareas. Esta acción no se puede deshacer.`;
}

function buildColumns(archived: boolean) {
  const base = [
    columnHelper.accessor("name", {
      header: "Nombre",
      cell: (info) => (
        <Link href={`/companies/${info.row.original.id}`} className="font-medium underline">
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor("industry", {
      header: "Industria",
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("createdAt", {
      header: "Creada",
      cell: (info) => new Date(info.getValue()).toLocaleDateString("es-MX"),
    }),
  ];

  const actions = columnHelper.display({
    id: "actions",
    header: "",
    cell: (info) => {
      const c = info.row.original;
      return (
        <div className="flex items-center gap-3">
          {archived ? (
            <form action={restoreCompanyAction}>
              <input type="hidden" name="id" value={c.id} />
              <button className="text-sm underline">Restaurar</button>
            </form>
          ) : (
            <Link href={`/companies/${c.id}`} className="text-sm underline">
              Editar
            </Link>
          )}
          <DeleteEntityDialog
            id={c.id}
            action={deleteCompanyAction}
            title="Eliminar empresa"
            description={companyDeleteDescription(c)}
          />
        </div>
      );
    },
  });

  return [...base, actions];
}

export function CompanyTable({
  data,
  archived = false,
}: {
  data: CompanyListRow[];
  archived?: boolean;
}) {
  const table = useReactTable({
    data,
    columns: buildColumns(archived),
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <p className="mt-8 text-sm text-muted">
        {archived ? "No hay empresas archivadas." : "Aún no hay empresas."}
      </p>
    );
  }

  return (
    <table className="mt-8 w-full text-left text-sm">
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id} className="border-b border-line">
            {hg.headers.map((h) => (
              <th key={h.id} className="col-label py-2">
                {flexRender(h.column.columnDef.header, h.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className="border-b border-line">
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="py-2">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
