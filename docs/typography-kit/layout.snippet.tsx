// Destino: app/layout.tsx  (fragmento — integra en tu RootLayout existente)
//
// Aplica las tres variables de fuente al <html>. A partir de ahí, font-sans /
// font-display / font-mono (y las utilidades del globals.css) funcionan en toda la app.

import type { Metadata } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mexillum CRM",
  description: "CRM interno — pipeline comercial y operativo de Mexillum",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning es útil si luego agregas theming claro/oscuro
    <html lang="es" className={fontVariables} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
