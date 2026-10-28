/**
 * Límite de pedidos por clave en ventana deslizante, en memoria.
 *
 * Alcanza para frenar abusos obvios en una sola instancia. En producción con
 * varias instancias serverless cada una tiene su propio contador: cuando haga
 * falta algo estricto, mover esto a Redis/Upstash o a una tabla de Supabase.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return function check(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterSeconds: number } {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return { ok: false, retryAfterSeconds: Math.ceil((windowMs - (now - recent[0])) / 1000) };
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 10_000) hits.delete(hits.keys().next().value!);
    return { ok: true };
  };
}
