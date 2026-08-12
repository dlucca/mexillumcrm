import { db } from "@/db/client";
import { listCompanies } from "@/db/companies";
import { CompanyTable } from "@/components/company-table";
import { NewCompanyForm } from "@/components/new-company-form";
import { signOut } from "@/app/login/actions";

// Always render at request time — this page reads live data from the DB and
// must not be statically prerendered (which would hit the DB during `next build`).
export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await listCompanies(db);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-4xl tracking-display">Empresas</h1>
        <form action={signOut}>
          <button className="font-semibold text-sm underline">Salir</button>
        </form>
      </div>
      <NewCompanyForm />
      <CompanyTable data={companies} />
    </main>
  );
}
