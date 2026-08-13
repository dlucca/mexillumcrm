"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProjectAction, createCompanyByNameAction } from "@/app/projects/actions";
import type { ActionResult } from "@/lib/company-mutations";
import { STAGES, STATUSES, labelOf, stageGroupFor, formatMXN } from "@/lib/project-pipeline";
import { formatUSD, MXN_PER_USD } from "@/lib/currency";
import { GROUP_DOT, SOLUTION_BADGE, stageIndex } from "@/lib/dashboard-display";

type CompanyOption = { id: string; name: string };

const SOL_OPTS = [
  { value: "solar", label: "Solar", desc: "Generación FV", dot: "var(--solar)" },
  { value: "bess", label: "BESS", desc: "Almacenamiento", dot: "var(--storage)" },
  { value: "solar_bess", label: "Solar + BESS", desc: "Híbrido", dot: "var(--sol-both)" },
];

const field =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-solar focus:ring-2 focus:ring-solar/25";
const labelCls = "mb-1.5 block text-[0.78rem] font-semibold";
const req = <span className="text-solar-ink">*</span>;

function Section({ n, title, opt, children }: { n: number; title: string; opt?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid size-[22px] place-items-center rounded-md bg-ink font-mono text-[0.72rem] text-background">
          {n}
        </span>
        <h2 className="font-display text-[1.12rem] font-bold">{title}</h2>
        {opt ? <span className="ml-auto col-label text-[0.68rem] text-faint">{opt}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2 py-1 text-[0.82rem] ${ok ? "text-muted" : "text-ink"}`}>
      <span
        className={`grid size-4 place-items-center rounded-[5px] ${
          ok ? "bg-success text-white" : "border-[1.5px] border-line-strong"
        }`}
      >
        {ok ? (
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M2 8l4 4 8-9" />
          </svg>
        ) : null}
      </span>
      {children}
    </div>
  );
}

export function ProjectCreateForm({
  companies: initialCompanies,
  preselectedCompanyId,
}: {
  companies: CompanyOption[];
  preselectedCompanyId?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createProjectAction,
    null
  );

  const [companies, setCompanies] = useState<CompanyOption[]>(initialCompanies);
  const [companyId, setCompanyId] = useState(preselectedCompanyId ?? "");

  // Crear empresa inline (solo nombre)
  const newCompanyRef = useRef<HTMLDetailsElement>(null);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [newCompanyError, setNewCompanyError] = useState<string | null>(null);

  async function handleCreateCompany() {
    const name = newCompanyName.trim();
    if (name === "") {
      setNewCompanyError("El nombre es obligatorio");
      return;
    }
    setCreatingCompany(true);
    setNewCompanyError(null);
    const res = await createCompanyByNameAction(name);
    setCreatingCompany(false);
    if (res.ok) {
      setCompanies((prev) => [res.company, ...prev]);
      setCompanyId(res.company.id);
      setNewCompanyName("");
      if (newCompanyRef.current) newCompanyRef.current.open = false;
    } else {
      setNewCompanyError(res.error);
    }
  }

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [solutionType, setSolutionType] = useState("unknown");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [probability, setProbability] = useState("");
  const [stage, setStage] = useState("lead_sin_contactar");
  const [status, setStatus] = useState("open");

  useEffect(() => {
    if (state?.ok) router.push("/projects");
  }, [state, router]);

  const companyName = companies.find((c) => c.id === companyId)?.name ?? "";
  const valueNum = estimatedValue.trim() === "" ? null : Number(estimatedValue);
  const sol = SOLUTION_BADGE[solutionType] ?? SOLUTION_BADGE.unknown;
  const idx = stageIndex(stage);
  const groupColor = GROUP_DOT[stageGroupFor(stage)] ?? "var(--group-lead)";

  const checks = [
    { k: "Empresa", ok: companyId !== "" },
    { k: "Nombre del proyecto", ok: name.trim() !== "" },
    { k: "Ubicación (ciudad)", ok: city.trim() !== "" },
    { k: "Tipo de solución", ok: solutionType !== "unknown" },
    { k: "Valor estimado", ok: valueNum != null && valueNum > 0 },
    { k: "Etapa inicial", ok: stage !== "" },
  ];
  const done = checks.filter((c) => c.ok).length;

  return (
    <form action={formAction} className="flex min-w-0 flex-col">
      <input type="hidden" name="solutionType" value={solutionType} />

      {/* Topbar */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 py-4 md:px-8">
        <div>
          <div className="text-[0.76rem] text-muted">
            <Link href="/projects" className="hover:underline">
              Proyectos
            </Link>{" "}
            › Nuevo proyecto
          </div>
          <h1 className="mt-0.5 font-display text-[1.9rem] font-bold leading-none tracking-display">
            Nuevo proyecto
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/projects" className="px-2 py-2 text-sm font-semibold text-muted hover:text-ink">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-solar px-4 py-2.5 text-sm font-semibold text-on-solar transition-colors hover:bg-solar-strong disabled:opacity-50"
          >
            {pending ? "Creando…" : "Crear proyecto"}
          </button>
        </div>
      </div>

      <div className="grid max-w-[1240px] items-start gap-6 px-5 py-6 md:px-8 lg:grid-cols-[1fr_336px]">
        {/* FORM */}
        <div className="flex min-w-0 flex-col gap-5">
          <Section n={1} title="Empresa">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className={labelCls + " mb-0"}>Empresa propietaria {req}</label>
              <details ref={newCompanyRef} className="relative">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[0.74rem] font-semibold text-solar-ink hover:underline marker:hidden">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M7 2v10M2 7h10" />
                  </svg>
                  Nueva empresa
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-[0_8px_28px_oklch(0.3_0.02_60/0.14)]">
                  <div className="flex flex-col gap-2">
                    <label className="col-label text-[0.68rem] text-muted">Nombre de la empresa</label>
                    <input
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleCreateCompany();
                        }
                      }}
                      placeholder="Grupo Alcázar"
                      className="rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm outline-none focus:border-solar focus:ring-2 focus:ring-solar/25"
                    />
                    {newCompanyError ? (
                      <p className="text-[0.78rem] text-danger-ink">{newCompanyError}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleCreateCompany()}
                      disabled={creatingCompany}
                      className="mt-0.5 rounded-lg bg-solar px-3 py-2 text-[0.82rem] font-semibold text-on-solar transition-colors hover:bg-solar-strong disabled:opacity-50"
                    >
                      {creatingCompany ? "Creando…" : "Crear empresa"}
                    </button>
                  </div>
                </div>
              </details>
            </div>
            <select
              name="companyId"
              required
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className={field}
            >
              <option value="">Selecciona una empresa…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[0.72rem] text-faint">
              Un proyecto pertenece a una empresa. Crea una nueva con “Nueva empresa” sin salir de aquí.
            </p>
          </Section>

          <Section n={2} title="Planta / ubicación">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Nombre del proyecto {req}</label>
                <input name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ramos Arizpe — Nave 2" className={field} />
                <p className="mt-1.5 text-[0.7rem] text-faint">Una planta = un proyecto. Usa un nombre que la identifique.</p>
              </div>
              <div>
                <label className={labelCls}>Ciudad</label>
                <input name="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ramos Arizpe" className={field} />
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <input name="state" value={stateName} onChange={(e) => setStateName(e.target.value)} placeholder="Coahuila" className={field} />
              </div>
              <div>
                <label className={labelCls}>Descripción <span className="font-normal text-faint">(opcional)</span></label>
                <input name="notes" placeholder="Contexto, tipo de instalación…" className={field} />
              </div>
            </div>
          </Section>

          <Section n={3} title="Solución y valor">
            <label className={labelCls}>Tipo de solución {req}</label>
            <div className="grid grid-cols-3 gap-2">
              {SOL_OPTS.map((o) => {
                const selected = solutionType === o.value;
                return (
                  <button
                    type="button"
                    key={o.value}
                    onClick={() => setSolutionType(selected ? "unknown" : o.value)}
                    className={`rounded-[9px] border p-2.5 text-center transition-colors ${
                      selected ? "border-[var(--sol-both)] bg-[color-mix(in_oklch,var(--sol-both)_8%,var(--surface))]" : "border-line-strong hover:border-line"
                    }`}
                  >
                    <div className="text-[0.86rem] font-semibold">
                      <span className="mr-1 inline-block size-2 rounded-[3px] align-middle" style={{ background: o.dot }} />
                      {o.label}
                    </div>
                    <div className="mt-px text-[0.66rem] text-muted">{o.desc}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Valor estimado {req}</label>
                <div className="flex items-center overflow-hidden rounded-lg border border-line-strong bg-surface">
                  <span className="border-r border-line bg-surface-2 px-3 py-2.5 font-mono text-sm text-muted">$</span>
                  <input
                    name="estimatedValue"
                    type="number"
                    min="0"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    placeholder="3,100,000"
                    className="w-full px-3 py-2.5 font-mono text-[0.95rem] font-medium tabular-nums outline-none"
                  />
                  <span className="border-l border-line px-3 py-2.5 text-[0.78rem] text-muted">MXN</span>
                </div>
                <p className="mt-1.5 font-mono text-[0.72rem] text-faint">
                  ≈ {formatUSD(valueNum)} USD · TC {MXN_PER_USD.toFixed(2)} (automático)
                </p>
              </div>
              <div>
                <label className={labelCls}>Potencial <span className="font-normal text-faint">(opcional)</span></label>
                <div className="flex items-center overflow-hidden rounded-lg border border-line-strong bg-surface">
                  <input
                    name="probability"
                    type="number"
                    min="0"
                    max="100"
                    value={probability}
                    onChange={(e) => setProbability(e.target.value)}
                    placeholder="70"
                    className="w-full px-3 py-2.5 font-mono text-[0.95rem] font-medium tabular-nums outline-none"
                  />
                  <span className="border-l border-line px-3 py-2.5 text-[0.78rem] text-muted">/ 100</span>
                </div>
              </div>
            </div>
          </Section>

          <Section n={4} title="Pipeline">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Etapa inicial {req}</label>
                <select name="stage" value={stage} onChange={(e) => setStage(e.target.value)} className={field}>
                  {STAGES.map((s, i) => (
                    <option key={s.value} value={s.value}>
                      {String(i + 1).padStart(2, "0")} · {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-3 text-[0.72rem] text-faint">
              Responsable y primera acción se asignarán a tu usuario por ahora — la selección de responsable llega con el módulo de usuarios.
            </p>
          </Section>

          {state && !state.ok ? (
            <p className="rounded-lg bg-danger-wash px-3 py-2 text-sm font-medium text-danger-ink">{state.error}</p>
          ) : null}
        </div>

        {/* RAIL */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="col-label mb-3 text-[0.72rem] text-muted">Vista previa</div>
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-line-strong p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display text-[0.98rem] font-semibold leading-tight">{name || "Nombre del proyecto"}</div>
                  <div className="text-[0.7rem] text-muted">{companyName || "Empresa"}</div>
                </div>
                <span className="whitespace-nowrap rounded-[5px] px-1.5 py-0.5 font-mono text-[0.6rem]" style={{ background: `color-mix(in oklch, ${groupColor} 14%, var(--surface))`, color: groupColor }}>
                  {String(idx).padStart(2, "0")} · {labelOf(STAGES, stage)}
                </span>
              </div>
              <div className="font-mono text-[1rem] font-medium tabular-nums">
                {valueNum != null ? formatMXN(valueNum) : "—"} <span className="text-[0.62rem] text-muted">MXN</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${sol.className} text-[0.58rem]`}>{sol.label}</span>
                <span className="ml-auto font-mono text-[0.7rem] text-muted">
                  {probability.trim() !== "" ? `Pot. ${probability}` : "—"}
                </span>
              </div>
            </div>
            <p className="mt-2.5 text-[0.7rem] text-faint">Así se verá la card en el Pipeline.</p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="col-label mb-2.5 text-[0.72rem] text-muted">Campos requeridos · {done}/{checks.length}</div>
            {checks.map((c) => (
              <Check key={c.k} ok={c.ok}>
                {c.k}
              </Check>
            ))}
          </div>

          <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[0.76rem] leading-relaxed text-muted">
            El proyecto se crea con una actividad inicial de sistema. Documentos, diagnóstico y checklist de datos llegan en slices posteriores.
          </p>
        </aside>
      </div>
    </form>
  );
}
