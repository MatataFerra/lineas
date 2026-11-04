import Link from "next/link";
import { PlusIcon } from "@/components/icons";

/** Sin pistas no hay búsqueda: se invita a volver a la home a armarlas. */
export function NoClues() {
  return (
    <div className="mt-10 max-w-md">
      <h2 className="font-serif text-[28px] leading-tight">Todavía no hay pistas</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">Contanos un libro, una frase, una época o una sensación, y trazamos tres caminos desde ahí.</p>
      <Link href="/" className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[13px] font-medium text-accent-ink">
        <PlusIcon size={14} strokeWidth={2} />
        Agregar pistas
      </Link>
    </div>
  );
}
