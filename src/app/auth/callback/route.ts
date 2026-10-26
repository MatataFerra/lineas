import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Destino del enlace mágico (flujo PKCE): canjea el `code` por una sesión y
 * redirige adonde estaba el usuario.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createServerSupabase();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth/callback]", error.message);
  }

  return NextResponse.redirect(new URL("/ingresar?error=enlace", origin));
}

/** Solo rutas internas: evita redirecciones abiertas a otros dominios. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}
