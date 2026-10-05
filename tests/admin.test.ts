import { beforeAll, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import type { Store } from '@/server/store';
import { AppError, getAttemptView, saveAnswers, submitPart } from '@/server/attempt';
import { regenerateLink, resetClock } from '@/server/invitations';
import { getCandidateDetail, saveEvaluation, saveNote } from '@/server/review';
import { buildExport, toCsv, toXlsx } from '@/server/export';
import { at, fillAnswers, freshDb, invite, min, startedAttempt, T0, variantOf, viewPart } from './helpers';

let db: Store;
beforeAll(async () => {
  db = await freshDb();
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof AppError) return e.code;
    return `otro: ${(e as Error).message}`;
  }
  return 'no_error';
};

describe('reinicio del reloj', () => {
  it('exige motivo, registra auditoría con el started_at anterior y da ventana completa nueva', async () => {
    const { id, token } = await startedAttempt(db);
    const p = await viewPart(db, token, at(T0, min(1)));
    await saveAnswers(db, token, '1A', [{ questionId: p.questions[0].id, text: 'texto previo' }], undefined, at(T0, min(2)));

    expect(await code(resetClock(db, id, 'admin@haptica.co', '', at(T0, min(30))))).toBe('reason_required');
    expect(await code(resetClock(db, id, 'admin@haptica.co', '  ab ', at(T0, min(30))))).toBe('reason_required');

    const r = await resetClock(db, id, 'admin@haptica.co', 'Se cayó la conexión del candidato', at(T0, min(30)));
    expect(r.deadlineAt).toBe(at(T0, min(120)).toISOString());

    const v = await getAttemptView(db, token, at(T0, min(31)));
    if (v.status !== 'en_curso') throw new Error('debería estar en curso');
    expect(v.deadlineAt).toBe(at(T0, min(120)).toISOString());
    expect(v.part.saved[p.questions[0].id].text).toBe('texto previo'); // se conserva lo escrito

    const d = await getCandidateDetail(db, id, at(T0, min(31)));
    const entry = d!.audit.find((a) => a.action === 'clock_reset')!;
    expect(entry.actor).toBe('admin@haptica.co');
    expect(entry.reason).toBe('Se cayó la conexión del candidato');
    expect(entry.details.previousStartedAt).toBe(T0.toISOString());
    expect(d!.invitation.clockResets).toBe(1);
  });

  it('también reabre una prueba expirada, pero no una sin iniciar ni una enviada', async () => {
    const { id, token } = await startedAttempt(db);
    expect((await getAttemptView(db, token, at(T0, min(100)))).status).toBe('expirada');
    await resetClock(db, id, 'admin@haptica.co', 'Falla de la plataforma', at(T0, min(100)));
    expect((await getAttemptView(db, token, at(T0, min(101)))).status).toBe('en_curso');

    const fresh = await invite(db);
    expect(await code(resetClock(db, fresh.id, 'admin@haptica.co', 'sin iniciar', at(T0, min(5))))).toBe('not_resettable');
  });

  it('el registro de auditoría es solo-añadir: set, merge, delete y re-create fallan', async () => {
    const { id } = await startedAttempt(db);
    await resetClock(db, id, 'admin@haptica.co', 'Falla de la plataforma', at(T0, min(5)));
    const [entry] = await db.query('auditLog', { where: [['action', '==', 'clock_reset']] });
    const path = `auditLog/${entry.id}`;
    await expect(db.set(path, { actor: 'otro' })).rejects.toThrow(/inmutable/);
    await expect(db.merge(path, { actor: 'otro' })).rejects.toThrow(/inmutable/);
    await expect(db.delete(path)).rejects.toThrow(/inmutable/);
    await expect(db.create(path, { actor: 'otro' })).rejects.toThrow(/ya existe/);
    await expect(db.tx(async (t) => t.delete(path))).rejects.toThrow(/inmutable/);
    expect((await db.get(path))!.actor).toBe('admin@haptica.co');
  });
});

describe('regenerar enlace', () => {
  it('el enlace anterior deja de servir y queda auditado; no aplica si ya inició', async () => {
    const inv = await invite(db);
    const next = await regenerateLink(db, inv.id, 'admin@haptica.co', at(T0, min(60)));
    expect(next.token).not.toBe(inv.token);
    expect(await code(getAttemptView(db, inv.token, at(T0, min(61))))).toBe('invalid_token');
    expect((await getAttemptView(db, next.token, at(T0, min(61)))).status).toBe('creada');

    const started = await startedAttempt(db);
    expect(await code(regenerateLink(db, started.id, 'admin@haptica.co'))).toBe('already_started');
  });
});

describe('calificación, evaluación y exportación', () => {
  async function completed(role: 'service_designer' | 'legal_service_designer' = 'service_designer') {
    const { id, token } = await startedAttempt(db, role);
    let t = 1;
    for (const part of ['1A', '1B', '2', '3'] as const) {
      const p = await viewPart(db, token, at(T0, min(t)));
      await submitPart(db, token, part, fillAnswers(p, 10), undefined, at(T0, min(t + 2)));
      t += 4;
    }
    return { id, token };
  }

  it('califica la Parte 2 por ítem y por habilidad, con la clave solo en el panel', async () => {
    const { id, token } = await startedAttempt(db);
    let t = 1;
    for (const part of ['1A', '1B'] as const) {
      const p = await viewPart(db, token, at(T0, min(t)));
      await submitPart(db, token, part, fillAnswers(p), undefined, at(T0, min(t + 1)));
      t += 3;
    }
    const p2 = await viewPart(db, token, at(T0, min(t)));
    // Marca la correcta en el ítem 1 (buscándola en la clave) y una incorrecta en el 2.
    const { keys } = await variantOf(db, id);
    const key = new Map(Object.entries(keys).map(([qid, k]) => [qid, k.correctOptionId]));
    const q1 = p2.questions[0];
    const q2 = p2.questions[1];
    const wrong = q2.options!.find((o) => o.id !== key.get(q2.id))!;
    await saveAnswers(db, token, '2', [{ questionId: q1.id, optionId: key.get(q1.id)! }, { questionId: q2.id, optionId: wrong.id }], undefined, at(T0, min(t + 1)));

    const d = await getCandidateDetail(db, id, at(T0, min(t + 2)));
    const part2 = d!.parts.find((p) => p.id === '2')!;
    expect(part2.questions[0].mc!.correct).toBe(true);
    expect(part2.questions[1].mc!.correct).toBe(false);
    expect(part2.questions[2].mc!.correct).toBeNull(); // sin responder
    const s01 = d!.part2BySkill.find((s) => s.skill === '01')!;
    expect(s01.total).toBeGreaterThanOrEqual(3); // ítems 1, 2 y 3 (01 y 02)
    expect(s01.correct).toBe(1);
    // No existe puntaje total en ninguna parte del detalle.
    expect(JSON.stringify(d)).not.toMatch(/total(Score|Points)|puntaje/i);
  });

  it('guarda estados por habilidad y notas; la habilidad 07 no se puede calificar', async () => {
    const { id } = await completed();
    await saveEvaluation(db, id, '01', 'solida', 'admin@haptica.co');
    await saveEvaluation(db, id, '04', 'indicio', 'admin@haptica.co');
    await saveEvaluation(db, id, 'p3_ejemplo', 'sin_evidencia', 'admin@haptica.co');
    await saveNote(db, id, '1A', 'Duda sobre el NPS: buena', 'admin@haptica.co');
    expect(await code(saveEvaluation(db, id, '07', 'solida', 'admin@haptica.co'))).toBe('bad_key');
    expect(await code(saveEvaluation(db, id, '01', 'excelente' as never, 'admin@haptica.co'))).toBe('bad_status');
    const d = await getCandidateDetail(db, id);
    expect(d!.evaluations).toMatchObject({ '01': 'solida', '04': 'indicio', 'p3_ejemplo': 'sin_evidencia' });
    expect(d!.notes['1A']).toBe('Duda sobre el NPS: buena');
    await saveEvaluation(db, id, '01', null, 'admin@haptica.co'); // limpiar
    expect((await getCandidateDetail(db, id))!.evaluations['01']).toBeUndefined();
  });

  it('exporta Excel y CSV útiles: una fila por candidato, hoja de respuestas abiertas y sin puntaje total', async () => {
    const local = await freshDb();
    const { id, token } = await (async () => {
      const inv = await invite(local);
      await (await import('@/server/attempt')).startAttempt(local, inv.token, true, T0);
      let t = 1;
      for (const part of ['1A', '1B', '2', '3'] as const) {
        const p = await viewPart(local, inv.token, at(T0, min(t)));
        await submitPart(local, inv.token, part, fillAnswers(p, 10), [{ kind: 'paste', questionId: p.questions[0].id, chars: 321 }], at(T0, min(t + 2)));
        t += 4;
      }
      return { id: inv.id, token: inv.token };
    })();
    void token;
    await saveEvaluation(local, id, '02', 'indicio', 'admin@haptica.co');
    await saveNote(local, id, '3', '=SUMA(1+1)', 'admin@haptica.co');

    const { candidatos, respuestas } = await buildExport(local, at(T0, min(60)));
    expect(candidatos.rows).toHaveLength(1);
    expect(candidatos.headers.join('|')).not.toMatch(/total|puntaje/i);
    expect(candidatos.headers.filter((h) => h.startsWith('P2 ítem'))).toHaveLength(12);
    expect(respuestas.rows).toHaveLength(8); // 1A(3) + 1B(2) + 3(3)
    expect(respuestas.rows.filter((r) => r[3] === '1A')).toHaveLength(3);
    expect(respuestas.rows.filter((r) => r[3] === '1B')).toHaveLength(2);
    expect(respuestas.rows.filter((r) => r[3] === '3')).toHaveLength(3);

    const buf = await toXlsx([candidatos, respuestas]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Candidatos', 'Respuestas abiertas']);
    expect(wb.getWorksheet('Candidatos')!.rowCount).toBe(2);

    const csv = toCsv(candidatos);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain("'=SUMA(1+1)"); // sin inyección de fórmulas
    const row = candidatos.rows[0];
    expect(row[candidatos.headers.indexOf('Eventos de pegado')]).toBe(4);
    expect(row[candidatos.headers.indexOf('Caracteres pegados')]).toBe(4 * 321);
  });
});
