import crypto from 'node:crypto';
import type { Store } from './store';

/** Límite por clave (p. ej. IP): se guardan las marcas de tiempo recientes en un documento por clave hasheada. */
const path = (key: string) => `rateLimits/${crypto.createHash('sha256').update(key).digest('hex').slice(0, 40)}`;

export async function isRateLimited(store: Store, key: string, max: number, windowSeconds: number, now = new Date()): Promise<boolean> {
  const doc = await store.get(path(key));
  const hits = ((doc?.hits as number[] | undefined) ?? []).filter((t) => t > now.getTime() - windowSeconds * 1000);
  return hits.length >= max;
}

export async function recordRateEvent(store: Store, key: string, now = new Date(), windowSeconds = 600): Promise<void> {
  await store.tx(async (t) => {
    const doc = await t.get(path(key));
    const hits = ((doc?.hits as number[] | undefined) ?? []).filter((x) => x > now.getTime() - windowSeconds * 1000);
    hits.push(now.getTime());
    await t.set(path(key), { hits: hits.slice(-100), updatedAt: now.toISOString() });
  });
}
