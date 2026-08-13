"use client";

import * as React from "react";
import { AlertDialog as Primitive } from "@base-ui/react/alert-dialog";
import { matchesConfirmation, type ImpactRow, type ImpactKey } from "@/lib/delete-impact";

// Iconos de fila de cascada (14px, stroke). Mapeados por key del impacto.
const ROW_ICON: Record<ImpactKey, React.ReactNode> = {
  projects: <path d="M2 13V6l6-4 6 4v7M6 13V9h4v4" />,
  contacts: (
    <>
      <circle cx="8" cy="5" r="2.5" />
      <path d="M3 13.5c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" />
    </>
  ),
  activities: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5V8l2.5 1.5" />
    </>
  ),
  tasks: (
    <>
      <path d="M4 1.5h5l3 3v10H4z" />
      <path d="M9 1.5V5h3" />
    </>
  ),
  pipeline: <path d="M8 1v14M4 4h6.5a2.5 2.5 0 0 1 0 5H4" />,
};

function RowIcon({ k }: { k: ImpactKey }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      {ROW_ICON[k]}
    </svg>
  );
}

export function DeleteEntityDialog({
  id,
  action,
  name,
  entityLabel,
  entityArticle,
  impact,
  confirmName = false,
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
  name: string;
  entityLabel: string; // "empresa" | "proyecto" (para el botón)
  entityArticle: "la" | "el"; // artículo para la descripción
  impact: ImpactRow[];
  confirmName?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");

  const gated = confirmName && !matchesConfirmation(confirmText, name);

  return (
    <Primitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmText("");
      }}
    >
      <Primitive.Trigger className="text-sm text-danger-ink hover:underline">
        Eliminar
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Backdrop className="fixed inset-0 z-50 bg-ink/55 supports-backdrop-filter:backdrop-blur-[1.5px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Primitive.Popup
          className="fixed top-1/2 left-1/2 z-50 w-[452px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-2xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <div className="p-6 pb-5">
            <div className="mb-3.5 grid size-[46px] place-items-center rounded-xl bg-danger-wash text-danger">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M12 2.5l10 18H2z" />
                <path d="M12 9.5v5M12 17.6v.1" />
              </svg>
            </div>

            <Primitive.Title className="font-display text-2xl font-bold leading-tight tracking-[-0.005em]">
              ¿Eliminar {name}?
            </Primitive.Title>
            <Primitive.Description className="mt-1.5 text-[0.88rem] leading-relaxed text-muted">
              Esta acción <b className="font-semibold text-ink">no se puede deshacer</b>. Se eliminará
              permanentemente {entityArticle} {entityLabel} <b className="font-semibold text-ink">{name}</b>
              {impact.length > 0 ? " y todos sus registros asociados en el CRM:" : "."}
            </Primitive.Description>

            {impact.length > 0 && (
              <ul className="mt-4 rounded-xl border border-danger/20 bg-danger-wash/45 px-3.5 py-1">
                {impact.map((row) => (
                  <li
                    key={row.key}
                    className="flex items-center gap-2.5 border-b border-dashed border-danger/[0.18] py-1.5 last:border-b-0"
                  >
                    <span className="grid w-4 place-items-center text-danger opacity-75">
                      <RowIcon k={row.key} />
                    </span>
                    <span className="min-w-[26px] text-right font-mono text-[0.95rem] font-medium tabular-nums text-danger-ink">
                      {row.value}
                    </span>
                    <span className="text-[0.86rem]">{row.label}</span>
                  </li>
                ))}
              </ul>
            )}

            {confirmName && (
              <div className="mt-4">
                <label htmlFor={`del-confirm-${id}`} className="mb-1.5 block text-[0.78rem] text-muted">
                  Para confirmar, escribe{" "}
                  <b className="font-mono font-medium text-ink">{name}</b>:
                </label>
                <input
                  id={`del-confirm-${id}`}
                  type="text"
                  autoComplete="off"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 font-mono text-[0.85rem] text-ink outline-none focus:border-danger focus:ring-[3px] focus:ring-danger-wash"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 border-t border-line bg-surface-2 px-6 py-4">
            <Primitive.Close className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-[0.85rem] font-semibold text-ink hover:bg-surface-2">
              Cancelar
            </Primitive.Close>
            <form action={action}>
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                disabled={gated}
                className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-4 py-2 text-[0.85rem] font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.5 9h6l.5-9" />
                </svg>
                Eliminar {entityLabel}
              </button>
            </form>
          </div>
        </Primitive.Popup>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
