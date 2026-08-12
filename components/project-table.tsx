"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import Link from "next/link";
import type { ProjectListRow } from "@/db/projects";
import { STAGES, STATUSES, SOLUTION_TYPES, labelOf, formatMXN } from "@/lib/project-pipeline";

const columnHelper = createColumnHelper<ProjectListRow>();

function buildColumns(showCompany: boolean) {
  // Explicit ColumnDef[] typing: accessors of different value types (string vs
  // number) mixed via conditional .push() would otherwise infer too narrow.
  const cols: ColumnDef<ProjectListRow, any>[] = [
    columnHelper.accessor("name", {
      header: "Nombre",
      cell: (info) => (
        <Link href={`/projects/${info.row.original.id}`} className="underline">
          {info.getValue()}
        </Link>
      ),
    }),
  ];
  if (showCompany) {
    cols.push(
      columnHelper.accessor("companyName", {
        header: "Empresa",
        cell: (info) => info.getValue() ?? "—",
      })
    );
  }
  cols.push(
    columnHelper.accessor("stage", {
      header: "Etapa",
      cell: (info) => labelOf(STAGES, info.getValue()),
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => labelOf(STATUSES, info.getValue()),
    }),
    columnHelper.accessor("solutionType", {
      header: "Solución",
      cell: (info) => labelOf(SOLUTION_TYPES, info.getValue()),
    }),
    columnHelper.accessor("estimatedValue", {
      header: "Valor",
      cell: (info) => formatMXN(info.getValue()),
    })
  );
  return cols;
}

export function ProjectTable({
  data,
  archived = false,
  showCompany = false,
}: {
  data: ProjectListRow[];
  archived?: boolean;
  showCompany?: boolean;
}) {
  const table = useReactTable({
    data,
    columns: buildColumns(showCompany),
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <p className="mt-4 text-sm text-neutral-500">
        {archived ? "No hay proyectos archivados." : "Aún no hay proyectos."}
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
