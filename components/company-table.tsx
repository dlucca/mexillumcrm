"use client";

import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Company } from "@/db/schema";
import { restoreCompanyAction } from "@/app/companies/[id]/actions";

const columnHelper = createColumnHelper<Company>();

function buildColumns(archived: boolean) {
  const base = [
    columnHelper.accessor("name", {
      header: "Nombre",
      cell: (info) => (
        <Link
          href={`/companies/${info.row.original.id}`}
          className="font-medium underline"
        >
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

  if (!archived) return base;

  return [
    ...base,
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => (
        <form action={restoreCompanyAction}>
          <input type="hidden" name="id" value={info.row.original.id} />
          <button className="text-sm underline">Restaurar</button>
        </form>
      ),
    }),
  ];
}

export function CompanyTable({
  data,
  archived = false,
}: {
  data: Company[];
  archived?: boolean;
}) {
  const table = useReactTable({
    data,
    columns: buildColumns(archived),
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <p className="mt-8 text-sm text-neutral-500">
        {archived ? "No hay empresas archivadas." : "Aún no hay empresas."}
      </p>
    );
  }

  return (
    <table className="mt-8 w-full text-left text-sm">
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
