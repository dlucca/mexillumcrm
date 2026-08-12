import type { Metadata } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mexillum CRM",
  description: "CRM interno — pipeline comercial y operativo de Mexillum",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning es útil si luego agregas theming claro/oscuro
    <html lang="es" className={fontVariables} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
