import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import { AuthListener } from "@/components/auth-listener";
import "./globals.css";

export const metadata: Metadata = {
  title: "Líneas",
  description: "No sabés qué leer. Pero sabés qué te mueve.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#151412" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full">
        <AuthListener />
        {children}
      </body>
    </html>
  );
}
