"use client";

import { THEME_KEY, applyTheme } from "@/lib/theme";
import { MoonIcon, SunIcon } from "./icons";

/**
 * Alterna entre claro y oscuro a partir del tema que se ve. El ícono lo elige
 * el CSS (variante dark:), así el servidor no necesita saber el tema.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const toggle = () => {
    const root = document.documentElement;
    const current = root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Sin almacenamiento el cambio vale para esta visita.
    }
  };

  return (
    <button
      type="button"
      aria-label="Cambiar entre modo claro y oscuro"
      onClick={toggle}
      className={`flex size-9 items-center justify-center rounded-full text-muted transition-[color,background-color,scale] duration-200 hover:bg-chip hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95 ${className}`}
    >
      <MoonIcon size={17} className="dark:hidden" />
      <SunIcon size={17} className="hidden dark:block" />
    </button>
  );
}
