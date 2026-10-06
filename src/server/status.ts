import { config } from './config';
import type { InvRow } from './model';

export type Status = 'creada' | 'vencida' | 'en_curso' | 'enviada' | 'expirada';

export const STATUS_LABEL: Record<Status, string> = {
  creada: 'Creada',
  vencida: 'Vencida sin iniciar',
  en_curso: 'En curso',
  enviada: 'Enviada',
  expirada: 'Expirada',
};

/** ¿Ya pasó el cierre de la prueba (TEST_CLOSES_AT)? Después de esa hora nadie puede iniciar. */
export function testClosed(now: Date): boolean {
  const c = config().testClosesAt;
  return !!c && now.getTime() > c.getTime();
}

/** El estado SIEMPRE se calcula a partir de las marcas de tiempo del servidor; nunca de un timer. */
export function computeStatus(inv: InvRow, now: Date): Status {
  if (!inv.startedAt || !inv.deadlineAt) {
    return now.getTime() > inv.expiresAt.getTime() || testClosed(now) ? 'vencida' : 'creada';
  }
  if (inv.finishedAt) return 'enviada';
  if (now.getTime() > inv.deadlineAt.getTime()) return 'expirada';
  return 'en_curso';
}

/** ¿Se aceptan escrituras? Hasta deadline + gracia (10 s por latencia), no más. */
export function canWrite(inv: InvRow, now: Date): boolean {
  if (!inv.startedAt || !inv.deadlineAt || inv.finishedAt) return false;
  return now.getTime() <= inv.deadlineAt.getTime() + config().graceSeconds * 1000;
}

export function remainingMs(inv: InvRow, now: Date): number | null {
  if (!inv.deadlineAt) return null;
  return Math.max(0, inv.deadlineAt.getTime() - now.getTime());
}
