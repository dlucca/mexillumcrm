"use client";

import { Fragment, useEffect, useState } from "react";
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
import { ContactEditForm } from "@/components/contact-edit-form";

const columnHelper = createColumnHelper<Contact>();

function buildColumns(
  archived: boolean,
  onEdit: (id: string) => void
) {
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
        <div className="flex items-center gap-3">
          {!archived && (
            <button
              type="button"
              onClick={() => onEdit(info.row.original.id)}
              className="text-sm underline"
            >
              Editar
            </button>
          )}
          <form action={action.fn}>
            <input type="hidden" name="id" value={info.row.original.id} />
            <input type="hidden" name="companyId" value={info.row.original.companyId} />
            <button className="text-sm underline">{action.label}</button>
          </form>
        </div>
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
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setEditingId(null);
  }, [archived]);

  const table = useReactTable({
    data,
    columns: buildColumns(archived, setEditingId),
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
          <Fragment key={row.id}>
            <tr className="border-b">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
            {editingId === row.original.id && (
              <tr className="border-b bg-neutral-50">
                <td colSpan={row.getVisibleCells().length} className="px-2">
                  <ContactEditForm
                    key={row.original.id}
                    contact={row.original}
                    onDone={() => setEditingId(null)}
                  />
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
