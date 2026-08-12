# Sistema Tipográfico — Mexillum CRM

> **Estado:** Definición inicial. Base tipográfica del producto antes de escribir UI.
> **Dirección:** Industrial técnico — confiable, de ingeniería, con aire de panel de control energético.
> **Contexto:** CRM interno, UI 100% español (MX), densidad alta de datos (pipeline, montos MXN/USD, scores del motor de diagnóstico, etapas, fechas).

---

## 1. Familias y roles

Tres familias, cada una con un trabajo distinto. No se solapan.

| Familia | Rol | Por qué |
|---|---|---|
| **Barlow Condensed** | Display y títulos: título de página, headers de sección, títulos de card, eyebrows en mayúsculas, KPI hero. | Grotesca condensada con carácter de señalética/infraestructura. Da el acento industrial y ocupa poco ancho horizontal, ideal para headers en layouts densos. |
| **Barlow** | Cuerpo y UI: párrafos, labels de formulario, botones, celdas de tabla, navegación, ayudas. | Misma superfamilia que Condensed → cohesión total. Humanista, limpia, muy legible a tamaños pequeños. El caballo de batalla. |
| **JetBrains Mono** | Datos: montos MXN/USD, scores (0–100), porcentajes, fechas, IDs, cantidades, códigos de etapa. | Monoespaciada = alineación vertical perfecta en columnas. Da el registro de "instrumento de medición" sin caer en el mono-como-decoración. |

**Regla de oro para los números:** Todo valor que viva en una **columna**, requiera **alineación** o sea una **cifra precisa** → JetBrains Mono con `tabular-nums`. La única excepción son los **KPI hero** del dashboard (1–2 cifras grandes de impacto), que van en Barlow Condensed por presencia visual.

> Máximo 3 familias — ya estamos en el límite. No agregar una cuarta. El contraste es por **proporción** (condensada / normal / monoespaciada), que es un pairing válido y fuerte, no por familias que compiten.

---

## 2. Pesos cargados

Cargar solo lo que se usa. Cada peso pesa en el bundle.

| Familia | Pesos | Uso |
|---|---|---|
| Barlow Condensed | **600** SemiBold, **700** Bold | 600 = headers de sección y títulos de card. 700 = título de página y KPI hero. |
| Barlow | **400** Regular, **500** Medium, **600** SemiBold | 400 = cuerpo. 500 = labels/UI enfatizada. 600 = botones y labels fuertes. |
| JetBrains Mono | **400** Regular, **500** Medium | 400 = datos en tablas. 500 = valores destacados (monto principal de un card). |

Total: 7 archivos de peso. Cargar vía `next/font/google` (self-host automático, sin layout shift, sin llamada a Google en runtime):

```ts
// app/fonts.ts
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";

export const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
  display: "swap",
});

export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});
```

Aplicar las tres `variable` en `<html>` o `<body>` y consumirlas desde los tokens CSS de §5.

---

## 3. Escala de tamaños (fija, `rem`, base 16px)

Escala fija — **no** `clamp()` fluido. Las UIs densas de datos necesitan predictibilidad espacial (igual que Material, Polaris, Carbon). Ratio ≈ 1.2 anclado en 16px. Ajustable en 1 breakpoint si hace falta, no de forma continua.

| Token | rem | px | Uso |
|---|---|---|---|
| `--text-2xs` | 0.6875 | 11 | Eyebrows en mayúsculas, micro-labels, badges de etapa. |
| `--text-xs` | 0.75 | 12 | Captions, timestamps, metadata secundaria de tabla. |
| `--text-sm` | 0.875 | 14 | UI secundaria, celdas de tabla, labels de formulario. |
| `--text-base` | 1 | 16 | Cuerpo por defecto, texto de lectura. **Mínimo para cuerpo.** |
| `--text-lg` | 1.125 | 18 | Lead / texto enfatizado, valor de dato inline. |
| `--text-xl` | 1.25 | 20 | Título de card (h4). |
| `--text-2xl` | 1.5 | 24 | Header de sección (h3). |
| `--text-3xl` | 2 | 32 | Título de vista (h2). |
| `--text-4xl` | 2.5 | 40 | Título de página (h1). |
| `--text-5xl` | 3.25 | 52 | KPI hero del dashboard. |

**Jerarquía por combinación**, no solo por tamaño: tamaño + peso + familia + color + espacio. Nunca apoyar la jerarquía en un solo eje.

---

## 4. Roles semánticos

La receta exacta para cada rol. Consistencia = mismo rol, mismo estilo, siempre.

| Rol | Familia / Peso | Tamaño | line-height | letter-spacing | Caso |
|---|---|---|---|---|---|
| **Eyebrow / overline** | Condensed 600 | `2xs` | 1.3 | `0.12em` | MAYÚSCULAS. Etiqueta de sección, categoría sobre un título. |
| **Título de página (h1)** | Condensed 700 | `4xl` | 1.03 | `-0.005em` | Sentence case. Nombre de la vista. |
| **Título de vista (h2)** | Condensed 700 | `3xl` | 1.08 | 0 | Sección mayor dentro de una página. |
| **Header de sección (h3)** | Condensed 600 | `2xl` | 1.1 | 0 | Bloques dentro de una vista. |
| **Título de card (h4)** | Condensed 600 | `xl` | 1.2 | 0 | Nombre de proyecto/empresa en un card. |
| **Lead / intro** | Barlow 400 | `lg` | 1.45 | 0 | Texto introductorio, resumen. |
| **Cuerpo** | Barlow 400 | `base` | 1.55 | 0 | Párrafos, descripciones. Medida objetivo **60–75ch**. |
| **Cuerpo pequeño / UI** | Barlow 400 | `sm` | 1.45 | 0 | Texto de tabla, ayudas, notas. |
| **Label de formulario** | Barlow 500 | `sm` | 1.4 | 0 | Etiqueta sobre un input. |
| **Label fuerte / columna** | Condensed 600 | `xs` | 1.3 | `0.08em` | MAYÚSCULAS. Encabezado de columna de tabla, label de metadato. |
| **Botón** | Barlow 600 | `sm` | 1 | `0.01em` | Acción. |
| **Caption / timestamp** | Barlow 400 | `xs` | 1.4 | 0 | Metadata, "hace 3 días". |
| **Dato / cifra en tabla** | Mono 400 | `sm` | 1.35 | 0 | Montos, scores, fechas en columnas. `tabular-nums`. |
| **Valor principal de card** | Mono 500 | `lg`–`xl` | 1.2 | 0 | Monto destacado de un proyecto. `tabular-nums`. |
| **KPI hero** | Condensed 700 | `5xl` | 1.0 | `-0.01em` | 1–2 cifras grandes de impacto en el dashboard. |

---

## 5. Tokens (CSS variables + Tailwind)

Nombres **semánticos**, no por valor (`--text-body`, no `--font-16`).

```css
:root {
  /* Familias */
  --font-display: var(--font-barlow-condensed), "Arial Narrow", system-ui, sans-serif;
  --font-body:    var(--font-barlow), system-ui, -apple-system, sans-serif;
  --font-mono:    var(--font-mono), ui-monospace, "SF Mono", monospace;

  /* Escala */
  --text-2xs: 0.6875rem;
  --text-xs:  0.75rem;
  --text-sm:  0.875rem;
  --text-base: 1rem;
  --text-lg:  1.125rem;
  --text-xl:  1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 2rem;
  --text-4xl: 2.5rem;
  --text-5xl: 3.25rem;

  /* line-height */
  --leading-display: 1.05;
  --leading-heading: 1.15;
  --leading-body:    1.55;
  --leading-ui:      1.4;
  --leading-data:    1.35;

  /* tracking */
  --tracking-eyebrow: 0.12em;
  --tracking-label:   0.08em;
  --tracking-display: -0.01em;
}

/* Datos siempre alineados y con guiones sin ligadura */
.data, .tabular { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
body { font-family: var(--font-body); font-kerning: normal; -webkit-font-smoothing: antialiased; }
```

Extensión de Tailwind (`tailwind.config.ts`) para usarlo con `font-display`, `text-4xl`, etc.:

```ts
theme: {
  extend: {
    fontFamily: {
      display: ["var(--font-barlow-condensed)", "sans-serif"],
      sans:    ["var(--font-barlow)", "system-ui", "sans-serif"],
      mono:    ["var(--font-mono)", "monospace"],
    },
    fontSize: {
      "2xs": ["0.6875rem", { lineHeight: "1.3" }],
      xs:  ["0.75rem",  { lineHeight: "1.4" }],
      sm:  ["0.875rem", { lineHeight: "1.45" }],
      base:["1rem",     { lineHeight: "1.55" }],
      lg:  ["1.125rem", { lineHeight: "1.45" }],
      xl:  ["1.25rem",  { lineHeight: "1.2" }],
      "2xl":["1.5rem",  { lineHeight: "1.1" }],
      "3xl":["2rem",    { lineHeight: "1.08" }],
      "4xl":["2.5rem",  { lineHeight: "1.03" }],
      "5xl":["3.25rem", { lineHeight: "1.0" }],
    },
  },
}
```

> **shadcn/ui:** shadcn usa `font-sans` para casi todo. Al mapear `font-sans → Barlow` y `font-mono → JetBrains Mono`, la mayoría de componentes heredan el sistema. Solo hay que aplicar `font-display` explícitamente en `CardTitle`, headings y el eyebrow.

---

## 6. Convenciones de datos numéricos

- **Montos:** `$1,240,000 MXN` en Mono 500, `tabular-nums`. El equivalente USD va **debajo o al lado, muted y más pequeño**: `≈ $68,900 USD` en Mono 400 `xs`. El símbolo `$` y el código de moneda son parte del patrón, siempre.
- **Scores (0–100):** Mono 500, `tabular-nums`. Ej. `82` / `100`.
- **Porcentajes:** Mono. Ej. `+18%`, `34%`.
- **Fechas:** Mono `sm`. Formato corto MX: `12 ago 2026`.
- **IDs / códigos de etapa:** Mono `xs`, muted. Ej. `PRJ-0042`, etapa `4/13`.
- Nunca mezclar mono y proporcional dentro de la misma cifra.

---

## 7. Reglas rápidas (DO / DON'T)

**DO**
- Usar la escala. Nunca inventar tamaños sueltos (15px, 17px…).
- Cuerpo mínimo 16px; 14px solo para UI secundaria/tabla.
- `tabular-nums` en toda cifra que se compare o alinee.
- Jerarquía por familia + peso + tamaño + color + espacio, combinados.
- Eyebrows y encabezados de columna en MAYÚSCULAS con tracking abierto (`0.08–0.12em`).
- `next/font` con `display: swap` y stack de fallback definido.

**DON'T**
- No usar Barlow Condensed para cuerpo o textos largos (es display).
- No usar JetBrains Mono como "estética developer" en texto corrido — solo datos.
- No agregar una cuarta familia (Inter/Roboto/etc.).
- No poner tracking en cuerpo ni en títulos grandes en minúscula (salvo el leve negativo del display).
- No apoyar la jerarquía solo en el tamaño.
- No usar `px` para tamaños de fuente — `rem` para respetar el zoom del usuario.

---

## 8. Nota sobre color

Los neutros del specimen están **tintados en cálido** (hacia ámbar solar) para cohesión, evitando negro/blanco puros. El acento ámbar es un **placeholder** que representa "energía solar" y se usa con moderación (etapa activa, énfasis). La paleta de marca definitiva se define aparte (no es parte de este spec tipográfico).
