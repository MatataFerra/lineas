"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useLineas } from "@/lib/store";
import { MenuIcon, UserIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Descubrir", match: ["/", "/resultados", "/conexiones", "/libro"] },
  { href: "/explorar", label: "Explorar", match: ["/explorar"] },
  { href: "/biblioteca", label: "Mi biblioteca", match: ["/biblioteca"] },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useLineas((s) => s.user);
  const authReady = useLineas((s) => s.authReady);
  const [menu, setMenu] = useState<"nav" | "account" | null>(null);

  // Un menú abierto se cierra con Escape o con un clic fuera de él y de su botón
  // (todo el encabezado como "dentro" dejaba franjas donde el clic no cerraba).
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    const onPointer = (e: PointerEvent) => !(e.target as Element).closest("[data-menu]") && setMenu(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menu]);

  const loginHref = `/ingresar?next=${encodeURIComponent(pathname)}`;
  const signOut = async () => {
    setMenu(null);
    await getBrowserSupabase()?.auth.signOut();
    router.push("/");
  };

  return (
    <header className="relative flex items-center justify-between gap-6">
      <Link href="/" className="font-serif text-[26px] tracking-[-0.01em] md:text-[28px]">
        Líneas
      </Link>

      {/* Centrada respecto del encabezado, no del espacio libre: no se mueve cuando cambia lo de los costados. */}
      <nav aria-label="Principal" className="hidden gap-9 text-[13px] md:absolute md:left-1/2 md:flex md:-translate-x-1/2">
        {NAV.map((item) => {
          const current = item.match.some((m) => pathname === m || (m !== "/" && pathname.startsWith(`${m}/`)));
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={current ? "border-b-[1.5px] border-accent py-1.5" : "py-1.5 text-muted hover:text-ink"}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* El tema queda fijo contra el borde; la cuenta, a su izquierda, aparece cuando se sabe la sesión. */}
      <div className="-mr-2.5 flex items-center gap-1 md:mr-0 md:gap-2">
        <div className="hidden md:block">
          {user ? (
            <button
              type="button"
              data-menu
              aria-label="Tu cuenta"
              aria-expanded={menu === "account"}
              onClick={() => setMenu(menu === "account" ? null : "account")}
              className="animate-fade flex size-9 items-center justify-center rounded-full border border-line bg-chip font-serif text-[15px] uppercase"
            >
              {user.email?.charAt(0) ?? <UserIcon />}
            </button>
          ) : (
            authReady &&
            pathname !== "/ingresar" && (
              <Link
                href={loginHref}
                className="animate-fade inline-flex h-9 items-center gap-2 rounded-full border border-line px-3.5 text-[13px] hover:bg-chip"
              >
                <UserIcon size={15} />
                Ingresar
              </Link>
            )
          )}
        </div>
        <ThemeToggle />

        <button
          type="button"
          data-menu
          aria-label={menu === "nav" ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menu === "nav"}
          onClick={() => setMenu(menu === "nav" ? null : "nav")}
          className="flex size-11 items-center justify-center md:hidden"
        >
          <MenuIcon size={20} />
        </button>
      </div>

      {menu && (
        <div
          data-menu
          className={`animate-fade absolute top-full right-0 z-30 mt-2 flex w-56 flex-col rounded-xl border border-line bg-surface p-2 text-sm shadow-lg ${menu === "account" ? "hidden md:flex" : "md:hidden"}`}
        >
          {user && <div className="truncate px-3 pt-1.5 pb-2 text-xs text-muted">{user.email}</div>}
          {menu === "nav" &&
            NAV.map((item) => (
              <Link key={item.label} href={item.href} onClick={() => setMenu(null)} className="rounded-lg px-3 py-2.5 hover:bg-chip">
                {item.label}
              </Link>
            ))}
          {menu === "account" && (
            <Link href="/biblioteca" onClick={() => setMenu(null)} className="rounded-lg px-3 py-2.5 hover:bg-chip">
              Mi biblioteca
            </Link>
          )}
          {user ? (
            <button type="button" onClick={signOut} className="rounded-lg px-3 py-2.5 text-left hover:bg-chip">
              Cerrar sesión
            </button>
          ) : (
            <Link href={loginHref} onClick={() => setMenu(null)} className="rounded-lg px-3 py-2.5 hover:bg-chip">
              Ingresar
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
