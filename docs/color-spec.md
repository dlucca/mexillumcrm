# Sistema de Color — Mexillum CRM

> **Estado:** Definición inicial de marca. Paleta base del producto, complementaria al [sistema tipográfico](typography-spec.md).
> **Dirección:** Industrial técnico — panel de control energético, con lenguaje de señalética/infraestructura.
> **Contexto:** CRM interno de energía **solar + almacenamiento BESS**. UI 100% español (MX), densidad alta de datos, sobria y operativa (PRD §11.1). shadcn/ui + Tailwind v4 + Recharts.

---

## 0. Concepto

Mexillum vende dos cosas: **generar** energía (solar) y **almacenarla** (BESS). Esa dualidad es el corazón de la marca y da dos polos de color naturales, no decorativos:

| Polo | Significado | Hue |
|---|---|---|
| **Sol** — ámbar | Generación, energía, "vivo/activo", dinero en juego. El acento de marca. | ~62 (dorado) |
| **Almacenamiento** — teal eléctrico | BESS, batería, red, técnica/ingeniería, info. El polo frío. | ~214 (teal-azul) |

Todo se apoya sobre **neutros cálidos** (tintados hacia el ámbar solar, ya establecidos en el specimen tipográfico), evitando negro/blanco puros. La regla 60/30/10: **60%** neutros cálidos (estructura), **30%** teal + verde/rojo semánticos, **10%** ámbar solar (énfasis, acción, "live"). Color estratégico, nunca arcoíris: la UI del PRD debe priorizar claridad sobre efectos.

**Anti-slop:** nada de cian-sobre-negro, gradientes morado-azul, ni glow. El teal es un petróleo grounded, no neón; el ámbar hace de "hi-vis" de señalética, no de brillo decorativo.

---

## 1. Roles del sistema

| Rol | Token | Uso |
|---|---|---|
| **Solar / primary** | `--solar` | Botón primario (relleno ámbar, texto oscuro), etapa activa, KPI hero, foco (`ring`), énfasis "live". |
| **Storage / info** | `--storage` | BESS, enlaces, chips informativos, selección, elementos técnicos/ingeniería. |
| **Success / won** | `--success` | `status = won`, salud, conversión positiva, checklist resuelto. |
| **Danger / lost** | `--danger` | `status = lost`, tareas vencidas, "sin next action", errores destructivos. |
| **Neutro / paused** | neutros | `status = paused`, inactivo, metadata, la mayor parte de la superficie. |

> No existe un "warning" separado: en un panel energético el **ámbar solar ya ES la señal de atención** (compuerta de datos faltantes, deal calentándose). Un color menos, semántica más limpia.

---

## 2. Tokens de marca (OKLCH)

OKLCH por uniformidad perceptual: pasos iguales de L se ven iguales. Neutros con un pelo de chroma (nunca gris puro) tintados al hue del sol.

### 2.1 Neutros cálidos

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--bg` | `oklch(0.985 0.006 80)` | `oklch(0.185 0.010 66)` | Fondo de app. |
| `--surface` | `oklch(0.998 0.003 85)` | `oklch(0.225 0.012 66)` | Cards, paneles. |
| `--surface-2` | `oklch(0.965 0.006 78)` | `oklch(0.265 0.013 66)` | Header de tabla, raised sutil, hover de fila. |
| `--ink` | `oklch(0.26 0.014 60)` | `oklch(0.94 0.008 82)` | Texto primario. |
| `--muted` | `oklch(0.50 0.016 62)` | `oklch(0.71 0.012 78)` | Texto secundario. |
| `--faint` | `oklch(0.64 0.014 65)` | `oklch(0.56 0.012 70)` | Placeholder, metadata terciaria. |
| `--line` | `oklch(0.90 0.008 72)` | `oklch(0.31 0.012 68)` | Bordes, divisores. |
| `--line-strong` | `oklch(0.83 0.010 70)` | `oklch(0.41 0.014 68)` | Divisor fuerte, borde de input. |

### 2.2 Solar (primary)

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--solar` | `oklch(0.70 0.155 62)` | `oklch(0.78 0.150 68)` | Relleno de acento, botón primario, etapa activa. |
| `--solar-strong` | `oklch(0.62 0.160 55)` | `oklch(0.84 0.140 70)` | Hover/pressed. |
| `--solar-ink` | `oklch(0.44 0.130 52)` | `oklch(0.82 0.130 70)` | Texto ámbar (link/valor) — pasa 4.5:1. |
| `--solar-wash` | `oklch(0.955 0.035 78)` | `oklch(0.30 0.055 66)` | Fondo de chip/hover tintado. |
| `--on-solar` | `oklch(0.24 0.030 55)` | `oklch(0.20 0.030 60)` | Texto oscuro **sobre** relleno ámbar (look señalética). |

> **Botón primario = ámbar + tinta oscura.** El ámbar a L0.70 no da 4.5:1 con blanco; con tinta oscura sí, y además es el lenguaje visual de señalética/hi-vis que pide la dirección de marca.

### 2.3 Storage / info (secondary)

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--storage` | `oklch(0.50 0.110 214)` | `oklch(0.66 0.110 212)` | Relleno info/BESS (texto blanco). |
| `--storage-ink` | `oklch(0.48 0.110 218)` | `oklch(0.74 0.100 214)` | Texto/enlace. |
| `--storage-wash` | `oklch(0.955 0.025 220)` | `oklch(0.30 0.040 220)` | Fondo de chip. |
| `--on-storage` | `oklch(0.99 0.005 220)` | `oklch(0.16 0.020 220)` | Texto sobre relleno storage. |

---

## 3. Semántica de estado

| Estado | Token base | Wash | Ink (texto) |
|---|---|---|---|
| **Success / won** | `--success` `oklch(0.58 0.13 150)` | `oklch(0.95 0.03 150)` | `oklch(0.46 0.12 150)` |
| **Danger / lost / vencido** | `--danger` `oklch(0.55 0.18 25)` | `oklch(0.955 0.03 25)` | `oklch(0.50 0.19 25)` |

Dark: `--success oklch(0.72 0.14 152)` · `--danger oklch(0.68 0.17 25)` (washes en L~0.30, inks claros). **Nunca solo color:** siempre acompañar de icono/label/patrón (accesibilidad). `paused`/inactivo = neutro (`--muted` + `--surface-2`), sin color propio.

---

## 4. Escalas de dominio

### 4.1 `solution_type` (producto) — usa los polos de marca

| Valor | Color | Racional |
|---|---|---|
| `solar` | `--solar` (ámbar) | Generación / sol. |
| `bess` | `--storage` (teal) | Batería / almacenamiento. |
| `solar_bess` | `--sol-both` `oklch(0.56 0.095 258)` (índigo) | La mezcla de ambos polos; en badge, split ámbar+teal. |
| `unknown` | `--faint` (neutro) | Sin dato. |

### 4.2 `stage_group` (6 columnas Kanban) — "temperatura del deal"

Progresión fría→cálida→verde que codifica avance. Chroma contenido: aparece solo como **borde superior 3px + punto** en la columna (el 10%), nunca como flood — la UI neutra domina.

| # | Grupo | Light | Dark |
|---|---|---|---|
| 1 | Lead | `oklch(0.62 0.045 240)` | `oklch(0.68 0.05 240)` |
| 2 | Qualification | `oklch(0.58 0.095 214)` | `oklch(0.68 0.10 214)` |
| 3 | Solution | `oklch(0.60 0.100 196)` | `oklch(0.70 0.10 196)` |
| 4 | Commercial | `oklch(0.70 0.150 62)` | `oklch(0.80 0.14 66)` |
| 5 | Delivery | `oklch(0.66 0.155 40)` | `oklch(0.74 0.15 42)` |
| 6 | Active | `oklch(0.60 0.130 150)` | `oklch(0.72 0.13 152)` |

> El "calentón" de teal (paso 3) a ámbar (paso 4, Commercial) marca el momento en que el deal se pone serio y el dinero entra en juego — y deja las etapas de dinero en manos del ámbar de marca. Verde = cerrado/cliente activo.

### 4.3 `potencial_general` (heatmap del diagnóstico) — rampa cálida secuencial

Anclada en el ámbar de marca: a mayor potencial, más caliente.

| Nivel | Light |
|---|---|
| Bajo | `oklch(0.74 0.045 72)` |
| Medio | `oklch(0.72 0.105 66)` |
| Alto | `oklch(0.69 0.150 58)` |
| Muy Alto | `oklch(0.64 0.175 46)` |

Los **6 scores de palancas (0–100)** usan barras con relleno `--solar` de intensidad por valor; la palanca top del `ranking` se resalta. No 6 hues distintos.

---

## 5. Mapeo a shadcn/ui

shadcn usa un puñado de tokens; casi todo hereda. Ver `color-kit/globals.color.css` para el bloque completo.

| shadcn | Mexillum |
|---|---|
| `--background` / `--foreground` | `--bg` / `--ink` |
| `--card` / `--popover` | `--surface` |
| `--primary` / `--primary-foreground` | `--solar` / `--on-solar` |
| `--secondary` | `--surface-2` |
| `--muted` / `--muted-foreground` | `--surface-2` / `--muted` |
| `--accent` / `--accent-foreground` | `--solar-wash` / `--solar-ink` |
| `--destructive` | `--danger` |
| `--border` / `--input` | `--line` / `--line-strong` |
| `--ring` | `--solar` |

> Tokens extra fuera de shadcn (`--storage`, `--success`, escalas de dominio) se consumen directo desde clases utilitarias/componentes propios (pipeline, badges, charts).

---

## 6. Reglas rápidas (DO / DON'T)

**DO**
- 60/30/10: neutros cálidos dominan; teal+verde/rojo apoyan; ámbar es el 10% de énfasis.
- Ámbar = "vivo/activo/atención". Verde = won/salud. Rojo = lost/vencido. Teal = BESS/info.
- Sobre relleno ámbar, texto **oscuro** (`--on-solar`); nunca gris lavado sobre color.
- Estado siempre con icono/label además del color.
- OKLCH + `color-mix` para hovers y estados; neutros con leve tinte cálido.
- Charts (Recharts): categorías = polos de marca + verde; secuencial = rampa `potencial`.

**DON'T**
- No cian-sobre-negro, ni gradiente morado-azul, ni glow (AI slop).
- No arcoíris en el Kanban: hue solo como marcador de columna, no flood.
- No negro `#000` ni blanco `#fff` puros en áreas grandes.
- No apoyar un estado solo en el color.
- No usar el ámbar de marca como fondo grande — es acento (10%).

---

## 7. Accesibilidad

- Texto: `--ink`, `--muted`, `--solar-ink`, `--storage-ink`, `*-ink` semánticos ≥ 4.5:1 sobre su fondo.
- Componentes UI (bordes, rellenos de badge): ≥ 3:1.
- `--faint` solo para texto no esencial (placeholder, metadata).
- Rojo/verde nunca como único diferenciador (daltonismo): siempre icono/forma/label.
