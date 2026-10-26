"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useLineas } from "@/lib/store";
import { MenuIcon, UserIcon } from "./icons";

const NAV = [
  { href: "/", label: "Descubrir", match: ["/", "/resultados", "/conexiones"] },
  { href: "#", label: "Explorar", match: [] as string[] },
  { href: "/biblioteca", label: "Mi biblioteca", match: ["/biblioteca"] },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useLineas((s) => s.user);
  const authReady = useLineas((s) => s.authReady);
  const [menu, setMenu] = useState<"nav" | "account" | null>(null);

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

      <nav aria-label="Principal" className="hidden gap-9 text-[13px] md:flex">
        {NAV.map((item) => {
          const current = item.match.includes(pathname);
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

      <div className="hidden md:block">
        {user ? (
          <button
            type="button"
            aria-label="Tu cuenta"
            aria-expanded={menu === "account"}
            onClick={() => setMenu(menu === "account" ? null : "account")}
            className="flex size-9 items-center justify-center rounded-full border border-line bg-chip font-serif text-[15px] uppercase"
          >
            {user.email?.charAt(0) ?? <UserIcon />}
          </button>
        ) : (
          <Link
            href={loginHref}
            className={`inline-flex h-9 items-center gap-2 rounded-full border border-line px-3.5 text-[13px] hover:bg-chip ${authReady && pathname !== "/ingresar" ? "" : "invisible"}`}
          >
            <UserIcon size={15} />
            Ingresar
          </Link>
        )}
      </div>

      <button
        type="button"
        aria-label={menu === "nav" ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={menu === "nav"}
        onClick={() => setMenu(menu === "nav" ? null : "nav")}
        className="-mr-2.5 flex size-11 items-center justify-center md:hidden"
      >
        <MenuIcon size={20} />
      </button>

      {menu && (
        <div
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
