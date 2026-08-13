import type { Company, Contact } from "@/db/schema";
import { formatDateTime } from "@/lib/activity-log";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const two = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return two.toUpperCase() || "—";
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-line py-1.5 text-[0.82rem] last:border-b-0">
      <span className="text-muted">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function CompanyDetailsCard({ company }: { company: Company }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="col-label mb-2 text-[0.72rem] text-muted">Detalles</div>
      {company.industry ? <Row k="Sector" v={company.industry} /> : null}
      {company.companyType ? <Row k="Tipo" v={company.companyType} /> : null}
      {company.headquartersLocation ? <Row k="Sede" v={company.headquartersLocation} /> : null}
      {company.sizeSegment ? <Row k="Tamaño" v={company.sizeSegment} /> : null}
      {company.website ? (
        <Row
          k="Sitio web"
          v={
            <a href={normalizeUrl(company.website)} target="_blank" rel="noopener noreferrer" className="text-storage-ink hover:underline">
              {company.website.replace(/^https?:\/\//i, "")}
            </a>
          }
        />
      ) : null}
      {company.taxId ? <Row k="RFC" v={<span className="font-mono tabular-nums">{company.taxId}</span>} /> : null}
      {company.legalName ? <Row k="Razón social" v={company.legalName} /> : null}
      <Row k="Creado" v={<span className="font-mono">{formatDateTime(company.createdAt)}</span>} />
    </div>
  );
}

export function CompanyContactsCard({ contacts }: { contacts: Contact[] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="col-label mb-2.5 text-[0.72rem] text-muted">Contactos · {contacts.length}</div>
      {contacts.length === 0 ? (
        <p className="text-[0.8rem] text-muted">Sin contactos todavía.</p>
      ) : (
        contacts.slice(0, 6).map((c, i) => (
          <div key={c.id} className="flex items-center gap-2.5 py-1.5">
            <span className="grid size-[30px] shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2 font-display text-[0.7rem] font-bold text-muted">
              {initials(c.name)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[0.84rem] font-medium">{c.name}</div>
              {c.role ? <div className="truncate text-[0.7rem] text-muted">{c.role}</div> : null}
            </div>
            {i === 0 ? (
              <span className="ml-auto rounded-[5px] bg-solar-wash px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide text-solar-ink">
                Principal
              </span>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
