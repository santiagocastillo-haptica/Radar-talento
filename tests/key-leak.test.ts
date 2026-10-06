import { beforeAll, describe, expect, it } from 'vitest';
import type { Store } from '@/server/store';
import { getAttemptView, saveAnswers, submitPart } from '@/server/attempt';
import { seedContent } from '@/server/seed';
import { VARIANTS } from '@/content/variants';
import type { PartId } from '@/content/types';
import { at, fillAnswers, freshDb, min, startedAttempt, T0, variantOf, viewPart } from './helpers';

let db: Store;
beforeAll(async () => {
  db = await freshDb();
});

/** Recorre toda la prueba y devuelve el JSON crudo de TODAS las respuestas que vería el candidato. */
async function captureAllResponses(role: 'service_designer' | 'legal_service_designer') {
  const { token, view } = await startedAttempt(db, role);
  const raw: string[] = [JSON.stringify(view)];
  let t = 1;
  for (const part of ['1A', '1B', '2', '3'] as PartId[]) {
    const v = await getAttemptView(db, token, at(T0, min(t)));
    raw.push(JSON.stringify(v));
    if (v.status !== 'en_curso') throw new Error('no está en curso');
    const answers = fillAnswers(v.part);
    raw.push(JSON.stringify(await saveAnswers(db, token, part, answers, undefined, at(T0, min(t + 1)))));
    raw.push(JSON.stringify(await submitPart(db, token, part, answers, undefined, at(T0, min(t + 2)))));
    t += 4;
  }
  return raw;
}

describe('la clave de la Parte 2 nunca sale hacia el candidato', () => {
  for (const role of ['service_designer', 'legal_service_designer'] as const) {
    it(`ninguna respuesta de la API del candidato (${role}) contiene la clave`, async () => {
      const lines = await captureAllResponses(role);
      // Se revisan NOMBRES DE CAMPO (los enunciados pueden contener la palabra "correcta").
      const keys = new Set<string>();
      const walk = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) (keys.add(k), walk(x));
      };
      for (const line of lines) walk(JSON.parse(line));
      for (const k of keys) expect(k, `campo sospechoso "${k}"`).not.toMatch(/correct|answer.?key|skill|key$/i);
    });
  }

  it('el id de la opción correcta jamás aparece marcado: solo { id, text } por opción', async () => {
    const { id, token } = await startedAttempt(db);
    let t = 1;
    for (const part of ['1A', '1B'] as const) {
      const p = await viewPart(db, token, at(T0, min(t)));
      await submitPart(db, token, part, fillAnswers(p), undefined, at(T0, min(t + 1)));
      t += 3;
    }
    const p2 = await viewPart(db, token, at(T0, min(t)));
    for (const q of p2.questions) {
      expect(Object.keys(q).sort()).toEqual(['allowImage', 'id', 'kind', 'label', 'number', 'options', 'prompt', 'wordLimit']);
      for (const o of q.options!) expect(Object.keys(o).sort()).toEqual(['id', 'text']);
    }
    // La clave vive en otro documento que el flujo del candidato no lee.
    const { keys } = await variantOf(db, id);
    expect(Object.keys(keys)).toHaveLength(12);
  });

  it('el barajado es por candidato (dos candidatos no ven el mismo orden en todos los ítems)', async () => {
    const orders: string[][] = [];
    for (let i = 0; i < 2; i++) {
      const c = await startedAttempt(db);
      let t = 1;
      for (const part of ['1A', '1B'] as const) {
        const p = await viewPart(db, c.token, at(T0, min(t)));
        await submitPart(db, c.token, part, fillAnswers(p), undefined, at(T0, min(t + 1)));
        t += 3;
      }
      const p2 = await viewPart(db, c.token, at(T0, min(t)));
      const { variant } = await variantOf(db, c.id);
      const pos = new Map<string, number>();
      for (const q of variant.questions as { options?: { id: string }[] }[]) q.options?.forEach((o, idx) => pos.set(o.id, idx));
      orders.push(p2.questions.map((q) => q.options!.map((o) => pos.get(o.id)).join('')));
    }
    expect(orders[0]).not.toEqual(orders[1]);
  });
});

describe('contenido cargado por el seed', () => {
  it('hay 2 variantes, 12 ítems por variante y una clave por ítem', async () => {
    const variants = await db.query('variants');
    expect(variants).toHaveLength(VARIANTS.length);
    for (const v of variants) {
      const items = (v.data.questions as { part: string }[]).filter((q) => q.part === '2');
      expect(items).toHaveLength(12);
      const keys = (await db.get(`variantKeys/${v.id}`))!.keys;
      expect(Object.keys(keys)).toHaveLength(12);
    }
  });

  it('la clave coincide con la tabla de la sección 9.5 (ítems 1–10 comunes y 11–12 por rol)', async () => {
    const expected: Record<string, string> = {
      // Ítems 9 y 12 reescritos en la versión ajustada; ver README (la tabla del documento conserva letras de la versión anterior).
      'sd-renovacion-polizas-v2': 'ACDBDBCABBAB',
      'lsd-contrato-credito-v2': 'ACDBDBCABBCC',
    };
    for (const [slug, letters] of Object.entries(expected)) {
      const variant = (await db.get(`variants/${slug}`))!;
      const keys = (await db.get(`variantKeys/${slug}`))!.keys as Record<string, { correctOptionId: string }>;
      const got = Array.from({ length: 12 }, (_, i) => {
        const q = (variant.questions as { id: string; options: { id: string }[] }[]).find((x) => x.id === `2-${i + 1}`)!;
        return 'ABCD'[q.options.findIndex((o) => o.id === keys[q.id].correctOptionId)];
      }).join('');
      expect(got).toBe(letters);
    }
  });

  it('las habilidades de la clave coinciden con la sección 9.5', async () => {
    const keys = (await db.get('variantKeys/sd-renovacion-polizas-v2'))!.keys as Record<string, { skill: string }>;
    const skills = Array.from({ length: 12 }, (_, i) => keys[`2-${i + 1}`].skill);
    expect(skills).toEqual(['01', '01', '01,02', '03', '02', '05', '06', '08', '09', '04', '02', '03']);
    const lsd = (await db.get('variantKeys/lsd-contrato-credito-v2'))!.keys as Record<string, { skill: string }>;
    expect([lsd['2-11'].skill, lsd['2-12'].skill]).toEqual(['03', '01']);
  });

  it('el seed es idempotente (mismos ids de opción)', async () => {
    const before = JSON.stringify(await db.get('variants/sd-renovacion-polizas-v2'));
    await seedContent(db);
    expect(JSON.stringify(await db.get('variants/sd-renovacion-polizas-v2'))).toBe(before);
  });
});
