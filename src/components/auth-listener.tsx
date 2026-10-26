"use client";

import { useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useLineas } from "@/lib/store";

/**
 * Mantiene la sesión de Supabase sincronizada con el store.
 * La sesión del navegador sirve para la UI; lo que protege los datos son las
 * políticas RLS, que validan el token en cada consulta.
 */
export function AuthListener() {
  const setUser = useLineas((s) => s.setUser);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      void setUser(null);
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      // Diferido: no llamar a Supabase dentro del callback (puede bloquear el cliente de auth).
      setTimeout(() => void setUser(user ? { id: user.id, email: user.email ?? null } : null), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [setUser]);

  return null;
}
