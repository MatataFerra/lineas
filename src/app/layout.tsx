import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import { AuthListener } from "@/components/auth-listener";
import { THEME_COLORS, THEME_SCRIPT, type Theme } from "@/lib/theme";
import "./globals.css";

const description = "No sabés qué leer. Pero sabés qué te mueve.";

// Íconos e imagen para compartir salen de los archivos de esta carpeta (icon.svg, opengraph-image.png…).
export const metadata: Metadata = {
  // URLs absolutas para OpenGraph. En Vercel, sin la variable, Next usa el dominio de producción.
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: "Líneas",
  description,
  openGraph: { type: "website", locale: "es_AR", siteName: "Líneas", title: "Líneas", description },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // El script de tema cambia data-theme antes de hidratar: la diferencia es esperada.
    <html lang="es" className="h-full" suppressHydrationWarning>
      <head>
        {/* La barra del navegador según el sistema; con un tema forzado, THEME_SCRIPT antepone la suya. */}
        {(["light", "dark"] satisfies Theme[]).map((theme) => (
          <meta key={theme} name="theme-color" media={`(prefers-color-scheme: ${theme})`} content={THEME_COLORS[theme]} />
        ))}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <AuthListener />
        {children}
      </body>
    </html>
  );
}
