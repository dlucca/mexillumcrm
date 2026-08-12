"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Contact } from "@/db/schema";
import {
  archiveContactAction,
  restoreContactAction,
} from "@/app/companies/[id]/contacts/actions";

const columnHelper = createColumnHelper<Contact>();

function buildColumns(archived: boolean) {
  const action = archived
    ? { fn: restoreContactAction, label: "Restaurar" }
    : { fn: archiveContactAction, label: "Archivar" };

  return [
    columnHelper.accessor("name", { header: "Nombre" }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("phone", {
      header: "Teléfono",
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.accessor("role", {
      header: "Puesto",
      cell: (info) => info.getValue() ?? "—",
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => (
        <form action={action.fn}>
          <input type="hidden" name="id" value={info.row.original.id} />
          <input type="hidden" name="companyId" value={info.row.original.companyId} />
          <button className="text-sm underline">{action.label}</button>
        </form>
      ),
    }),
  ];
}

export function ContactTable({
  data,
  archived = false,
}: {
  data: Contact[];
  archived?: boolean;
}) {
  const table = useReactTable({
    data,
    columns: buildColumns(archived),
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <p className="mt-4 text-sm text-neutral-500">
        {archived ? "No hay contactos archivados." : "Aún no hay contactos."}
      </p>
    );
  }

  return (
    <table className="mt-4 w-full text-left text-sm">
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id} className="border-b">
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
          <tr key={row.id} className="border-b">
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
