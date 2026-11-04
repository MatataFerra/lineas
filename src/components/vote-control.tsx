"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { useLineas, type Vote } from "@/lib/store";

/**
 * «¿Te convence?» Sí / No. Votar lo mismo otra vez lo quita (lo decide el store).
 * Sin sesión no vota: invita a ingresar, porque los votos se suman para todos.
 */
export function VoteControl({ question, value, onVote, className = "" }: { question: string; value: Vote | undefined; onVote: (v: Vote) => void; className?: string }) {
  const pathname = usePathname();
  const user = useLineas((s) => s.user);
  const error = useLineas((s) => s.voteError);
  const [touched, setTouched] = useState(false);
  if (!isSupabaseConfigured()) return null;

  const vote = (v: Vote) => {
    setTouched(true);
    if (user) onVote(v);
  };

  return (
    <div className={className}>
      <div role="group" aria-label={question} className="flex items-center gap-1.5">
        <span className="mr-1 text-[11px] text-muted">{question}</span>
        <button
          type="button"
          aria-pressed={value === 1}
          onClick={() => vote(1)}
          className={`h-7 rounded-full border px-2.5 text-[11px] ${value === 1 ? "border-ink bg-ink text-bg" : "border-line hover:bg-chip"}`}>
          Sí
        </button>
        <button
          type="button"
          aria-pressed={value === -1}
          onClick={() => vote(-1)}
          className={`h-7 rounded-full border px-2.5 text-[11px] ${value === -1 ? "border-accent text-accent" : "border-line hover:bg-chip"}`}>
          No
        </button>
      </div>
      {touched && !user && (
        <p className="mt-1.5 text-[11px] text-muted">
          <Link href={`/ingresar?next=${encodeURIComponent(pathname)}`} className="text-ink underline underline-offset-[3px]">
            Ingresá
          </Link>{" "}
          para que tu voto cuente: los votos mejoran las conexiones para todos.
        </p>
      )}
      {touched && user && error && (
        <p role="alert" className="mt-1.5 text-[11px] text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
