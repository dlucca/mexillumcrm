// Destino: app/fonts.ts  (o src/app/fonts.ts si usas carpeta src/)
//
// next/font hace self-host automático de las fuentes: se descargan en build,
// se sirven desde tu dominio (sin llamada a Google en runtime) y sin layout shift.
// Cada familia expone una CSS variable que consumimos en globals.css.

import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";

// Cuerpo y UI — el caballo de batalla
export const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
  display: "swap",
});

// Display: títulos, eyebrows, KPI hero
export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

// Datos: montos, scores, fechas, IDs (siempre con tabular-nums)
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Helper para pegar las tres variables en <html> desde el layout.
export const fontVariables = [
  barlow.variable,
  barlowCondensed.variable,
  jetbrainsMono.variable,
].join(" ");
