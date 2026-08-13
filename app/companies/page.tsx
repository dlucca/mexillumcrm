import Link from "next/link";
import { db } from "@/db/client";
import { listCompaniesWithProjectCount } from "@/db/companies";
import { CompanyTable } from "@/components/company-table";
import { NewCompanyForm } from "@/components/new-company-form";
import { signOut } from "@/app/login/actions";

// Always render at request time — this page reads live data from the DB and
// must not be statically prerendered (which would hit the DB during `next build`).
export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const companies = await listCompaniesWithProjectCount(db, { archived: showArchived });

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-4xl tracking-display">Empresas</h1>
        <div className="flex items-center gap-4">
          <Link href="/projects" className="text-sm underline">
            Proyectos
          </Link>
          <form action={signOut}>
            <button className="font-semibold text-sm underline">Salir</button>
          </form>
        </div>
      </div>

      <div className="mt-6 flex gap-4 text-sm">
        <Link
          href="/companies"
          className={showArchived ? "underline" : "font-semibold"}
        >
          Activas
        </Link>
        <Link
          href="/companies?archived=1"
          className={showArchived ? "font-semibold" : "underline"}
        >
          Archivadas
        </Link>
      </div>

      {!showArchived && <NewCompanyForm />}
      <CompanyTable data={companies} archived={showArchived} />
    </main>
  );
}
