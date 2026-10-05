import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getStore } from '@/server/store';
import { requireSecret } from '@/server/config';
import { materializeExpiry } from '@/server/attempt';
import { toInv } from '@/server/model';

export const dynamic = 'force-dynamic';

/**
 * Materializa el estado `expirada` de pruebas vencidas (cron de Vercel). No es necesario para la corrección:
 * el estado siempre se calcula a partir de deadlineAt en cada lectura/escritura.
 */
export async function GET(req: Request) {
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${requireSecret('CRON_SECRET')}`);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const store = await getStore();
  const now = new Date();
  const open = await store.query('invitations', { where: [['closedAt', '==', null]] });
  let closed = 0;
  for (const d of open) {
    const inv = toInv(d.id, d.data);
    const after = await materializeExpiry(store, inv, now);
    if (after.closedAt && !inv.closedAt) closed += 1;
  }
  return NextResponse.json({ closed });
}
