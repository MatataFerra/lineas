import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import { AuthListener } from "@/components/auth-listener";
import { THEME_COLORS, THEME_SCRIPT, type Theme } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Líneas",
  description: "No sabés qué leer. Pero sabés qué te mueve.",
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
