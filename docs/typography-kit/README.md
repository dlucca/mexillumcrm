# Typography Kit — archivos drop-in

Sistema tipográfico del Mexillum CRM, listo para integrar cuando scaffoldees el app Next.js.
Referencia de decisiones: [`../typography-spec.md`](../typography-spec.md) · Vista: [`../typography-specimen.html`](../typography-specimen.html)

## Dónde va cada archivo

| Archivo del kit | Destino en el proyecto | Nota |
|---|---|---|
| `fonts.ts` | `app/fonts.ts` | Carga las 3 familias con `next/font` (self-host, sin layout shift). |
| `globals.css` | `app/globals.css` | **Tailwind v4** (CSS-first). Solo la parte tipográfica — fusiona con tus tokens de color/shadcn. |
| `layout.snippet.tsx` | `app/layout.tsx` | Fragmento: aplica las variables de fuente al `<html>`. Integra en tu RootLayout. |
| `tailwind.config.v3.ts` | `tailwind.config.ts` | **Solo si usas Tailwind v3.** Con v4 se ignora. |

## Pasos

1. Scaffold del app (ejemplo):

   ```bash
   npx create-next-app@latest . --ts --tailwind --app --eslint
   ```

2. Copia `fonts.ts` → `app/fonts.ts`.
3. **Tailwind v4** (default actual): reemplaza/mergea el `@theme` y las utilidades de `globals.css` en tu `app/globals.css`.
   **Tailwind v3**: copia `tailwind.config.v3.ts` → `tailwind.config.ts` y añade las utilidades `@layer components` que trae comentadas al final.
4. Aplica `fontVariables` al `<html>` según `layout.snippet.tsx`.
5. Verifica: un `<h1 className="font-display font-bold text-4xl">` debe salir en Barlow Condensed; un monto `<span className="data">$1,240,000</span>` en JetBrains Mono alineado.

## Cómo usar el sistema (cheatsheet)

| Rol | Clases |
|---|---|
| Título de página (h1) | `font-display font-bold text-4xl tracking-display` |
| Header de sección (h3) | `font-display font-semibold text-2xl` |
| Título de card | `font-display font-semibold text-xl` |
| Eyebrow / overline | `eyebrow` (o `font-display font-semibold text-2xs tracking-eyebrow uppercase`) |
| Cuerpo | por defecto (Barlow) — `text-base` |
| Label de formulario | `font-medium text-sm` |
| Botón | `font-semibold text-sm` |
| Encabezado de columna | `col-label` |
| Monto / score / fecha | `data` (Barlow Mono + `tabular-nums`) |
| KPI hero | `font-display font-bold text-5xl tracking-display` |

## Fuera de alcance de este kit

- **Paleta de color de marca** y tokens de shadcn (`--background`, `--primary`, `--border`…) — se definen aparte.
- **shadcn/ui**: al mapear `font-sans → Barlow` y `font-mono → JetBrains Mono`, la mayoría de componentes heredan el sistema. Aplica `font-display` explícito en `CardTitle` y headings.
