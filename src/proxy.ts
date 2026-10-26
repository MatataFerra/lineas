import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/env";

/**
 * Refresca la sesión de Supabase en cada request (Next 16: `proxy` reemplaza a
 * `middleware`). No protege rutas: la autorización real la hacen las políticas
 * RLS de la base y cada Route Handler.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseConfig) return response;

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Cache-Control / Expires / Pragma: una respuesta que escribe cookies de sesión no se cachea.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // No meter código entre la creación del cliente y getClaims(): es lo que refresca el token.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Todo menos estáticos e imágenes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
