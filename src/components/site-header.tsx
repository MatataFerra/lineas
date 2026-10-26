"use client";

import Link from "next/link";
import { useState } from "react";
import { MenuIcon, UserIcon } from "./icons";

const NAV = [
  { href: "/", label: "Descubrir", current: true },
  { href: "#", label: "Explorar", current: false },
  { href: "#", label: "Mi biblioteca", current: false },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative flex items-center justify-between gap-6">
      <Link href="/" className="font-serif text-[26px] tracking-[-0.01em] md:text-[28px]">
        Líneas
      </Link>

      <nav aria-label="Principal" className="hidden gap-9 text-[13px] md:flex">
        {NAV.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.current ? "page" : undefined}
            className={item.current ? "border-b-[1.5px] border-accent py-1.5" : "py-1.5 text-muted hover:text-ink"}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        aria-label="Tu cuenta"
        className="hidden size-9 items-center justify-center rounded-full border border-line bg-chip md:flex"
      >
        <UserIcon />
      </button>

      <button
        type="button"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="-mr-2.5 flex size-11 items-center justify-center md:hidden"
      >
        <MenuIcon size={20} />
      </button>

      {open && (
        <nav
          aria-label="Principal"
          className="animate-fade absolute top-full right-0 z-30 mt-2 flex w-48 flex-col rounded-xl border border-line bg-surface p-2 text-sm shadow-lg md:hidden"
        >
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={item.current ? "page" : undefined}
              className="rounded-lg px-3 py-2.5 hover:bg-chip"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
