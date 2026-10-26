"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useLineas } from "@/lib/store";

/** Aviso bajo los botones de biblioteca: errores, o que sin sesión no se conserva. */
export function LibraryNotice({ active }: { active: boolean }) {
  const pathname = usePathname();
  const user = useLineas((s) => s.user);
  const error = useLineas((s) => s.libraryError);

  if (error) {
    return (
      <p role="alert" className="mt-2 text-xs text-accent">
        {error}
      </p>
    );
  }
  if (active && !user && isSupabaseConfigured()) {
    return (
      <p className="mt-2 text-xs text-muted">
        Se guarda solo en esta sesión.{" "}
        <Link href={`/ingresar?next=${encodeURIComponent(pathname)}`} className="text-ink underline underline-offset-[3px]">
          Ingresá
        </Link>{" "}
        para conservarlo.
      </p>
    );
  }
  return null;
}
