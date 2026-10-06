import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Store } from '@/server/store';
import { AppError, getAttemptView, saveAnswers, startAttempt } from '@/server/attempt';
import { regenerateLink } from '@/server/invitations';
import { config } from '@/server/config';
import { at, freshDb, invite, min, viewPart } from './helpers';

// Jueves 8 de octubre de 2026, 1:00 p. m. hora de Colombia (UTC-5) = 18:00 UTC.
const CLOSE = new Date('2026-10-08T18:00:00.000Z');
let db: Store;
beforeAll(async () => {
  db = await freshDb();
});
beforeEach(() => {
  process.env.TEST_CLOSES_AT = '2026-10-08T13:00:00-05:00';
});
afterEach(() => {
  delete process.env.TEST_CLOSES_AT;
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof AppError ? e.code : `otro: ${(e as Error).message}`;
  }
  return 'no_error';
};

describe('cierre de la prueba (TEST_CLOSES_AT)', () => {
  it('interpreta la hora de Colombia: 1:00 p. m. -05:00 = 18:00 UTC', () => {
    expect(config().testClosesAt?.toISOString()).toBe(CLOSE.toISOString());
  });

  it('antes del cierre se puede iniciar y el candidato ve la hora de cierre', async () => {
    const inv = await invite(db, 'service_designer', at(CLOSE, -min(60)));
    const v = await getAttemptView(db, inv.token, at(CLOSE, -min(30)));
    expect(v.status).toBe('creada');
    if (v.status === 'creada') expect(v.closesAt).toBe(CLOSE.toISOString());
    expect((await startAttempt(db, inv.token, true, at(CLOSE, -1000))).status).toBe('en_curso'); // 1 s antes
  });

  it('después del cierre nadie nuevo puede iniciar: el enlace aún vigente responde "cerró"', async () => {
    const inv = await invite(db, 'service_designer', at(CLOSE, -min(60))); // el enlace vale 24 h: sigue vigente
    const later = at(CLOSE, min(1));
    const v = await getAttemptView(db, inv.token, later);
    expect(v).toMatchObject({ status: 'vencida', closed: true });
    expect(await code(startAttempt(db, inv.token, true, later))).toBe('test_closed');
    expect(await code(regenerateLink(db, inv.id, 'admin@haptica.co', later))).toBe('test_closed');
  });

  it('quien ya empezó antes del cierre conserva sus 90 minutos completos', async () => {
    const start = at(CLOSE, -min(30)); // empieza 30 min antes del cierre
    const inv = await invite(db, 'service_designer', at(start, -min(5)));
    await startAttempt(db, inv.token, true, start);
    const p = await viewPart(db, inv.token, at(CLOSE, min(20))); // ya pasó el cierre
    const r = await saveAnswers(db, inv.token, '1A', [{ questionId: p.questions[0].id, text: 'sigo escribiendo' }], undefined, at(CLOSE, min(40)));
    expect(r.rejected).toEqual([]);
    expect((await getAttemptView(db, inv.token, at(CLOSE, min(59)))).status).toBe('en_curso'); // 89 min desde que empezó
    expect((await getAttemptView(db, inv.token, at(CLOSE, min(61)))).status).toBe('expirada'); // 91 min
  });

  it('sin la variable o con un valor inválido no hay cierre', async () => {
    delete process.env.TEST_CLOSES_AT;
    expect(config().testClosesAt).toBeNull();
    process.env.TEST_CLOSES_AT = 'no-es-una-fecha';
    expect(config().testClosesAt).toBeNull();
    const inv = await invite(db, 'service_designer', at(CLOSE, -min(60)));
    expect((await getAttemptView(db, inv.token, at(CLOSE, min(5)))).status).toBe('creada');
  });
});

describe('una sola fecha para todos los enlaces sin iniciar', () => {
  beforeEach(() => {
    process.env.TEST_CLOSES_AT = '2026-10-08T13:00:00-05:00';
  });
  afterEach(() => {
    delete process.env.TEST_CLOSES_AT;
  });

  it('con cierre definido, un enlace creado 3 días antes sigue valiendo (no vence a las 24 h) hasta la hora de cierre', async () => {
    const created = at(CLOSE, -3 * 24 * 60 * min(1)); // martes
    const inv = await invite(db, 'service_designer', created);
    const stored = (await db.get(`invitations/${inv.id}`))!;
    expect(stored.expiresAt).toBe(CLOSE.toISOString()); // se guarda el cierre, no creación + 24 h
    expect(inv.expiresAt).toBe(CLOSE.toISOString());

    const v = await getAttemptView(db, inv.token, at(created, 30 * 60 * min(1))); // 30 h después
    expect(v.status).toBe('creada');
    if (v.status === 'creada') expect(v.expiresAt).toBe(CLOSE.toISOString());
    expect((await startAttempt(db, inv.token, true, at(CLOSE, -min(5)))).status).toBe('en_curso');
  });

  it('enlaces ya creados con 24 h también quedan válidos hasta el cierre', async () => {
    delete process.env.TEST_CLOSES_AT;
    const created = at(CLOSE, -2 * 24 * 60 * min(1));
    const inv = await invite(db, 'service_designer', created); // sin cierre: vence a las 24 h
    process.env.TEST_CLOSES_AT = '2026-10-08T13:00:00-05:00';
    expect((await getAttemptView(db, inv.token, at(created, 30 * 60 * min(1)))).status).toBe('creada');
    expect((await getAttemptView(db, inv.token, at(CLOSE, min(1)))).status).toBe('vencida');
  });

  it('regenerar un enlace también lo deja válido hasta el cierre', async () => {
    const created = at(CLOSE, -2 * 24 * 60 * min(1));
    const inv = await invite(db, 'service_designer', created);
    const next = await regenerateLink(db, inv.id, 'admin@haptica.co', at(created, min(90)));
    expect(next.expiresAt).toBe(CLOSE.toISOString());
  });

  it('sin cierre, el enlace sigue valiendo 24 h desde que se crea', async () => {
    delete process.env.TEST_CLOSES_AT;
    const inv = await invite(db, 'service_designer', at(CLOSE, -min(600)));
    expect(new Date(inv.expiresAt).getTime() - (CLOSE.getTime() - min(600))).toBe(24 * 60 * min(1));
  });
});
