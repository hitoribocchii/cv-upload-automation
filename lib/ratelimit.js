// Rate limit best-effort, en memoria del proceso.
//
// LIMITACION IMPORTANTE: en Vercel cada instancia serverless tiene su propia
// memoria y las instancias se reciclan. Esto frena al curioso y al bot torpe,
// NO a un atacante decidido. Si el form empieza a recibir abuso real,
// cambiá esto por Upstash Redis (@upstash/ratelimit) que es compartido
// entre instancias y tiene free tier.

const HITS = new Map(); // ip -> number[] (timestamps)
const WINDOW_MS = 60 * 60 * 1000; // 1 hora
const MAX_PER_WINDOW = 5;

export function checkRateLimit(ip) {
  const now = Date.now();
  const prev = (HITS.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (prev.length >= MAX_PER_WINDOW) {
    HITS.set(ip, prev);
    return { ok: false, retryAfterMin: Math.ceil((WINDOW_MS - (now - prev[0])) / 60000) };
  }

  prev.push(now);
  HITS.set(ip, prev);

  // Limpieza barata para que el Map no crezca sin techo.
  if (HITS.size > 5000) {
    for (const [key, times] of HITS) {
      if (times.every((t) => now - t >= WINDOW_MS)) HITS.delete(key);
    }
  }

  return { ok: true };
}

/** IP del cliente segun los headers que inyecta Vercel. */
export function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'desconocida';
}
