import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getCompany } from "@/db/companies";
import { CompanyDetailForm } from "@/components/company-detail-form";
import { CompanyArchiveButton } from "@/components/company-archive-button";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getCompany(db, id);
  if (!company) notFound();

  const archived = company.archivedAt !== null;

  return (
    <main className="mx-auto max-w-4xl p-8">
      <Link href="/companies" className="text-sm underline">
        ← Empresas
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display font-bold text-4xl tracking-display">
          {company.name}
        </h1>
        <CompanyArchiveButton id={company.id} archived={archived} />
      </div>
      {archived && (
        <p className="mt-2 text-sm text-neutral-500">Esta empresa está archivada.</p>
      )}
      <CompanyDetailForm company={company} />
    </main>
  );
}
