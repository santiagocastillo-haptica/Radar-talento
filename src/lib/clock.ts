/**
 * Reloj del cliente. Nunca confía en la hora del computador: se ancla a la hora del servidor
 * (`serverNow` de la última respuesta) y avanza con un reloj monótono (performance.now), que no
 * cambia si el usuario modifica la hora del sistema.
 */
export interface ClockSync {
  /** Hora del servidor (ms epoch) en el instante de la sincronización, ya compensada por la mitad del RTT. */
  serverMs: number;
  /** performance.now() en ese mismo instante. */
  perfMs: number;
}

export function makeSync(serverNowIso: string, perfAtRequest: number, perfAtResponse: number): ClockSync {
  const rtt = Math.max(0, perfAtResponse - perfAtRequest);
  return { serverMs: Date.parse(serverNowIso) + rtt / 2, perfMs: perfAtResponse };
}

export function serverNowMs(sync: ClockSync, perfNow: number): number {
  return sync.serverMs + (perfNow - sync.perfMs);
}

export function remainingMs(deadlineIso: string, sync: ClockSync, perfNow: number): number {
  return Math.max(0, Date.parse(deadlineIso) - serverNowMs(sync, perfNow));
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
