"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeftIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useLineas } from "@/lib/store";

type Phase = { kind: "form" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

export function LoginScreen({ next, linkError }: { next: string; linkError: boolean }) {
  const user = useLineas((s) => s.user);
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>(linkError ? { kind: "error", message: "El enlace venció o ya se usó. Pedí uno nuevo." } : { kind: "form" });
  const supabase = getBrowserSupabase();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setPhase({ kind: "sending" });
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect.toString() } });
    setPhase(error ? { kind: "error", message: "No pudimos mandar el enlace. Revisá el email y probá de nuevo." } : { kind: "sent", email: email.trim() });
  };

  return (
    <div className="min-h-dvh px-[22px] pt-5 pb-12 md:px-14 md:pt-7">
      <div className="mx-auto max-w-[1160px]">
        <SiteHeader />
        <Link href={next} className="mt-5 inline-flex items-center gap-2 py-2 text-[13px] text-muted hover:text-ink md:mt-7">
          <ArrowLeftIcon size={14} />
          Volver
        </Link>

        <div className="mx-auto mt-6 max-w-[440px] md:mt-16">
          <h1 className="font-serif text-[30px] leading-[1.1] md:text-[40px]">Ingresá a Líneas</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted md:text-[15px]">
            Para guardar libros en tu biblioteca y volver a tus búsquedas. Te mandamos un enlace por email, sin contraseña.
          </p>

          {!supabase && (
            <p role="alert" className="mt-8 rounded-xl border border-line bg-surface p-4 text-sm">
              Supabase no está configurado en este entorno: faltan <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.
            </p>
          )}

          {supabase && user && (
            <p className="mt-8 rounded-xl border border-line bg-surface p-4 text-sm">
              Ya iniciaste sesión como <span className="font-medium">{user.email}</span>.{" "}
              <Link href={next} className="underline underline-offset-[3px]">
                Seguir
              </Link>
            </p>
          )}

          {supabase && !user && phase.kind === "sent" && (
            <div role="status" className="mt-8 rounded-2xl border border-line bg-surface p-6">
              <h2 className="font-serif text-xl">Revisá tu correo</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Mandamos un enlace a <span className="text-ink">{phase.email}</span>. Abrilo desde este mismo navegador para entrar.
              </p>
              <button type="button" onClick={() => setPhase({ kind: "form" })} className="mt-4 text-[13px] text-muted underline underline-offset-[3px] hover:text-ink">
                Usar otro email
              </button>
            </div>
          )}

          {supabase && !user && phase.kind !== "sent" && (
            <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
              <label htmlFor="email" className="text-[13px] font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vos@ejemplo.com"
                className="h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none placeholder:text-muted focus:border-ink"
              />
              {phase.kind === "error" && (
                <p role="alert" className="text-[13px] text-accent">
                  {phase.message}
                </p>
              )}
              <button
                type="submit"
                disabled={phase.kind === "sending"}
                className="mt-2 h-12 rounded-full bg-accent text-[15px] font-medium text-accent-ink disabled:opacity-60"
              >
                {phase.kind === "sending" ? "Enviando…" : "Mandame el enlace"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
