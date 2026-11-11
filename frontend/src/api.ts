export interface Res<J = unknown> {
  ok: boolean;
  status: number;
  j: J;
}

export async function api<J = unknown>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<Res<J>> {
  try {
    const r = await fetch(path, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let j: unknown = null;
    try {
      j = await r.json();
    } catch {
      j = null;
    }
    return { ok: r.ok, status: r.status, j: (j ?? {}) as J };
  } catch {
    return { ok: false, status: 0, j: { error: 'Réseau indisponible.' } as unknown as J };
  }
}

/** Secondes -> "4:10" (minutes:secondes, utilisé pour les allures min/km). */
export function mmss(sec: number): string {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

/** Secondes -> durée lisible "1 h 05 min" / "12 min 30 s". */
export function dur(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return h + ' h ' + String(m).padStart(2, '0') + (r ? ' ' + r + ' s' : '');
  if (m > 0) return m + ' min' + (r ? ' ' + r + ' s' : '');
  return r + ' s';
}

/** "4:10" ou "4:10,5" -> secondes par km, ou null si invalide. */
export function parsePace(v: string | null | undefined): number | null {
  if (!v) return null;
  const t = v.trim().replace(',', '.');
  const m = t.match(/^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  const frac = m[3] ? Number('0.' + m[3]) : 0;
  const total = min * 60 + sec + frac;
  if (min < 1 || min > 30 || sec > 59) return null;
  return Math.round(total * 100) / 100;
}
