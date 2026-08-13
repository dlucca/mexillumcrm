import type { Metadata } from "next";
import { fontVariables } from "./fonts";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mexillum CRM",
  description: "CRM interno — pipeline comercial y operativo de Mexillum",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    // suppressHydrationWarning es útil si luego agregas theming claro/oscuro
    <html lang="es" className={fontVariables} suppressHydrationWarning>
      <body>
        <AppShell user={user ? { email: user.email ?? null } : null}>{children}</AppShell>
      </body>
    </html>
  );
}
