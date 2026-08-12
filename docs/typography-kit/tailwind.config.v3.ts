// SOLO si tu proyecto usa Tailwind v3 (create-next-app clásico con tailwind.config.ts).
// Si usas Tailwind v4 (CSS-first), IGNORA este archivo: todo vive en globals.css.
//
// Destino: tailwind.config.ts

import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-barlow)", "system-ui", "sans-serif"],
        display: ["var(--font-barlow-condensed)", "Arial Narrow", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1.3" }],
        xs: ["0.75rem", { lineHeight: "1.4" }],
        sm: ["0.875rem", { lineHeight: "1.45" }],
        base: ["1rem", { lineHeight: "1.55" }],
        lg: ["1.125rem", { lineHeight: "1.45" }],
        xl: ["1.25rem", { lineHeight: "1.2" }],
        "2xl": ["1.5rem", { lineHeight: "1.1" }],
        "3xl": ["2rem", { lineHeight: "1.08" }],
        "4xl": ["2.5rem", { lineHeight: "1.03" }],
        "5xl": ["3.25rem", { lineHeight: "1" }],
      },
      letterSpacing: {
        eyebrow: "0.12em",
        label: "0.08em",
        display: "-0.01em",
      },
    },
  },
  plugins: [],
} satisfies Config;

// En v3, las utilidades .eyebrow / .col-label / .data del globals.css v4 NO existen.
// Recréalas con @layer components en tu globals.css:
//
// @layer components {
//   .eyebrow   { @apply font-display font-semibold text-2xs tracking-eyebrow uppercase; }
//   .col-label { @apply font-display font-semibold text-xs  tracking-label   uppercase; }
//   .data      { @apply font-mono tabular-nums; }
// }
