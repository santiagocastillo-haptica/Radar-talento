import { beforeAll, describe, expect, it } from 'vitest';
import type { Store } from '@/server/store';
import { AppError, findInvitationByToken, getAttemptView, saveAnswers, startAttempt, submitPart } from '@/server/attempt';
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
    throw e;
  }
  return 'no_error';
};

describe('deadline y reanudación', () => {
  it('start fija deadline = started_at + 90 min y reabrir no reinicia el reloj', async () => {
    const { token, view } = await startedAttempt(db);
    if (view.status !== 'en_curso') throw new Error('debería estar en curso');
    expect(view.startedAt).toBe(T0.toISOString());
    expect(view.deadlineAt).toBe(at(T0, min(90)).toISOString());

    // "Cerrar la pestaña" y volver 40 min después: mismo deadline, mismo punto.
    const later = await getAttemptView(db, token, at(T0, min(40)));
    if (later.status !== 'en_curso') throw new Error('debería seguir en curso');
    expect(later.deadlineAt).toBe(view.deadlineAt);
    expect(later.part.id).toBe('1A');
    expect(Date.parse(later.deadlineAt) - Date.parse(later.serverNow)).toBe(min(50));

    // Presionar "Comenzar" otra vez (otra pestaña) tampoco mueve el reloj.
    const again = await startAttempt(db, token, true, at(T0, min(41)));
    if (again.status !== 'en_curso') throw new Error('debería seguir en curso');
    expect(again.startedAt).toBe(T0.toISOString());
    expect(again.deadlineAt).toBe(view.deadlineAt);
  });

  it('exige aceptar las reglas para comenzar', async () => {
    const inv = await invite(db);
    expect(await code(startAttempt(db, inv.token, false, T0))).toBe('terms_required');
    const v = await getAttemptView(db, inv.token, T0);
    expect(v.status).toBe('creada');
  });

  it('reanuda con el texto guardado', async () => {
    const { token } = await startedAttempt(db);
    const p = await viewPart(db, token, at(T0, min(1)));
    await saveAnswers(db, token, '1A', [{ questionId: p.questions[0].id, text: 'texto guardado antes de cerrar' }], undefined, at(T0, min(2)));
    const back = await viewPart(db, token, at(T0, min(30)));
    expect(back.saved[p.questions[0].id].text).toBe('texto guardado antes de cerrar');
  });
});

describe('enlace de 24 h', () => {
  it('vence a las 24 h si no se inició', async () => {
    const inv = await invite(db);
    const v = await getAttemptView(db, inv.token, at(T0, 24 * 60 * min(1) + 1000));
    expect(v.status).toBe('vencida');
    expect(await code(startAttempt(db, inv.token, true, at(T0, 24 * 60 * min(1) + 1000)))).toBe('link_expired');
  });

  it('a las 23 h 59 min todavía permite iniciar', async () => {
    const inv = await invite(db);
    const v = await startAttempt(db, inv.token, true, at(T0, 24 * 60 * min(1) - min(1)));
    expect(v.status).toBe('en_curso');
  });

  it('una vez iniciada, la prueba no depende de las 24 h', async () => {
    const { token } = await startedAttempt(db);
    const v = await getAttemptView(db, token, at(T0, min(60)));
    expect(v.status).toBe('en_curso');
  });

  it('token inválido o mal formado no encuentra nada', async () => {
    expect(await findInvitationByToken(db, 'x')).toBeNull();
    expect(await findInvitationByToken(db, 'a'.repeat(43))).toBeNull();
    expect(await code(getAttemptView(db, 'a'.repeat(43), T0))).toBe('invalid_token');
  });

  it('solo se guarda el hash del token', async () => {
    const inv = await invite(db);
    const doc = (await db.get(`invitations/${inv.id}`))!;
    expect(JSON.stringify(doc)).not.toContain(inv.token); // el token no está en ningún campo
    expect(doc.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('vencimiento', () => {
  it('a los 90 min se cierra solo y conserva lo escrito, aunque nadie tenga el navegador abierto', async () => {
    const { id, token } = await startedAttempt(db);
    const p = await viewPart(db, token, at(T0, min(5)));
    await saveAnswers(db, token, '1A', [{ questionId: p.questions[0].id, text: 'lo último que alcancé a escribir' }], undefined, at(T0, min(89)));

    const v = await getAttemptView(db, token, at(T0, min(90) + 1000));
    expect(v.status).toBe('expirada');
    const row = await findInvitationByToken(db, token);
    expect(row?.closedReason).toBe('expired');
    expect(row?.closedAt?.toISOString()).toBe(at(T0, min(90)).toISOString());

    const ans = await db.get(`invitations/${id}/answers/${p.questions[0].id}`);
    expect(ans?.text).toBe('lo último que alcancé a escribir');
  });

  it('acepta escrituras hasta deadline + 10 s y no más', async () => {
    const { id, token } = await startedAttempt(db);
    const p = await viewPart(db, token, at(T0, min(1)));
    const qid = p.questions[0].id;
    const deadline = at(T0, min(90));
    await saveAnswers(db, token, '1A', [{ questionId: qid, text: 'a tiempo' }], undefined, at(deadline, 9_000));
    expect(await code(saveAnswers(db, token, '1A', [{ questionId: qid, text: 'tarde' }], undefined, at(deadline, 11_000)))).toBe('expired');
    expect((await db.get(`invitations/${id}/answers/${qid}`))?.text).toBe('a tiempo'); // lo tardío no se guardó
    expect(await code(submitPart(db, token, '1A', [], undefined, at(deadline, 12_000)))).toBe('expired');
  });

  it('no se puede iniciar una prueba ya expirada', async () => {
    const { token } = await startedAttempt(db);
    expect(await code(startAttempt(db, token, true, at(T0, min(95))))).toBe('already_closed');
  });
});

describe('secuencia fija y sin retroceso', () => {
  it('1B no está en la respuesta del servidor antes de enviar 1A, y aparece después', async () => {
    const { token } = await startedAttempt(db);
    const p1a = await viewPart(db, token, at(T0, min(1)));
    expect(p1a.id).toBe('1A');
    expect(p1a.twist).toBeUndefined();

    const raw = JSON.stringify(await getAttemptView(db, token, at(T0, min(1))));
    expect(raw).not.toContain('gerente comercial te escribe');
    expect(raw).not.toContain('perdió 20% de su capacidad');
    expect(raw).not.toContain('Ajuste ante el giro');
    expect(raw).not.toContain('¿Qué cambia en tu decisión');

    await submitPart(db, token, '1A', fillAnswers(p1a), undefined, at(T0, min(20)));
    const p1b = await viewPart(db, token, at(T0, min(21)));
    expect(p1b.id).toBe('1B');
    expect(JSON.stringify(p1b.twist)).toContain('perdió 20% de su capacidad');
    expect(p1b.questions.map((q) => q.number)).toEqual([4, 5]);
  });

  it('no se puede escribir en una parte futura ni en una ya enviada', async () => {
    const { token } = await startedAttempt(db);
    const p1a = await viewPart(db, token, at(T0, min(1)));
    // Parte futura
    expect(await code(saveAnswers(db, token, '1B', [], undefined, at(T0, min(2))))).toBe('wrong_part');
    expect(await code(saveAnswers(db, token, '2', [], undefined, at(T0, min(2))))).toBe('wrong_part');
    expect(await code(submitPart(db, token, '3', [], undefined, at(T0, min(2))))).toBe('wrong_part');

    await submitPart(db, token, '1A', fillAnswers(p1a), undefined, at(T0, min(10)));
    // Parte ya enviada: bloqueada
    expect(await code(saveAnswers(db, token, '1A', [{ questionId: p1a.questions[0].id, text: 'cambio' }], undefined, at(T0, min(11))))).toBe('wrong_part');
    expect(await code(submitPart(db, token, '1A', [], undefined, at(T0, min(11))))).toBe('wrong_part');
  });

  it('no se puede escribir una pregunta de otra parte dentro de la parte activa', async () => {
    const { token } = await startedAttempt(db);
    const p1a = await viewPart(db, token, at(T0, min(1)));
    await submitPart(db, token, '1A', fillAnswers(p1a), undefined, at(T0, min(10)));
    const p1b = await viewPart(db, token, at(T0, min(11)));
    // Intento de colar una respuesta de 1A mientras la activa es 1B
    expect(await code(saveAnswers(db, token, '1B', [{ questionId: p1a.questions[0].id, text: 'hola' }], undefined, at(T0, min(12))))).toBe('bad_question');
    expect(p1b.id).toBe('1B');
  });

  it('flujo completo 1A → 1B → 2 → 3 termina en "enviada" y bloquea todo', async () => {
    const { token } = await startedAttempt(db);
    let t = 1;
    for (const part of ['1A', '1B', '2', '3'] as const) {
      const p = await viewPart(db, token, at(T0, min(t)));
      expect(p.id).toBe(part);
      const v = await submitPart(db, token, part, fillAnswers(p), undefined, at(T0, min(t + 1)));
      t += 5;
      if (part === '3') expect(v.status).toBe('enviada');
    }
    expect((await getAttemptView(db, token, at(T0, min(30)))).status).toBe('enviada');
    expect(await code(saveAnswers(db, token, '3', [], undefined, at(T0, min(31))))).toBe('finished');
  });
});

describe('límites de palabras en servidor', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

  it('rechaza el autoguardado por encima del límite de la pregunta y acepta el límite exacto', async () => {
    const { token } = await startedAttempt(db);
    const p = await viewPart(db, token, at(T0, min(1)));
    const q = p.questions[0]; // Diagnóstico, 120 palabras
    expect(q.wordLimit).toBe(120);
    const ok = await saveAnswers(db, token, '1A', [{ questionId: q.id, text: words(120) }], undefined, at(T0, min(2)));
    expect(ok.rejected).toEqual([]);
    const over = await saveAnswers(db, token, '1A', [{ questionId: q.id, text: words(121) }], undefined, at(T0, min(3)));
    expect(over.rejected).toEqual([{ questionId: q.id, code: 'over_limit' }]);
    const back = await viewPart(db, token, at(T0, min(4)));
    expect(back.saved[q.id].text).toBe(words(120)); // se conserva el último texto válido
  });

  it('el envío falla si algún campo excede el límite', async () => {
    const { token } = await startedAttempt(db);
    const p = await viewPart(db, token, at(T0, min(1)));
    const answers = fillAnswers(p);
    answers[1] = { questionId: p.questions[1].id, text: words(101) }; // Hipótesis, 100
    expect(await code(submitPart(db, token, '1A', answers, undefined, at(T0, min(2))))).toBe('over_limit');
    expect((await viewPart(db, token, at(T0, min(3)))).id).toBe('1A'); // no quedó enviada
  });

  it('Parte 3: límite de 300 palabras compartido entre los tres campos', async () => {
    const { token } = await startedAttempt(db);
    let t = 1;
    for (const part of ['1A', '1B', '2'] as const) {
      const p = await viewPart(db, token, at(T0, min(t)));
      await submitPart(db, token, part, fillAnswers(p), undefined, at(T0, min(t + 1)));
      t += 3;
    }
    const p3 = await viewPart(db, token, at(T0, min(t)));
    expect(p3.groupWordLimit).toBe(300);
    const [a, b, c] = p3.questions;
    const r1 = await saveAnswers(db, token, '3', [{ questionId: a.id, text: words(150) }, { questionId: b.id, text: words(100) }], undefined, at(T0, min(t + 1)));
    expect(r1.rejected).toEqual([]);
    // 150 + 100 + 51 = 301 → rechazado
    const r2 = await saveAnswers(db, token, '3', [{ questionId: c.id, text: words(51) }], undefined, at(T0, min(t + 2)));
    expect(r2.rejected).toEqual([{ questionId: c.id, code: 'over_group_limit' }]);
    const r3 = await saveAnswers(db, token, '3', [{ questionId: c.id, text: words(50) }], undefined, at(T0, min(t + 3)));
    expect(r3.rejected).toEqual([]);
    // El envío con 301 palabras repartidas también se rechaza.
    expect(
      await code(
        submitPart(db, token, '3', [{ questionId: a.id, text: words(151) }, { questionId: b.id, text: words(100) }, { questionId: c.id, text: words(50) }], undefined, at(T0, min(t + 4))),
      ),
    ).toBe('over_limit');
  });

  it('el rol se sustituye en el enunciado de la Parte 3', async () => {
    const { token } = await startedAttempt(db, 'legal_service_designer');
    let t = 1;
    for (const part of ['1A', '1B', '2'] as const) {
      const p = await viewPart(db, token, at(T0, min(t)));
      await submitPart(db, token, part, fillAnswers(p), undefined, at(T0, min(t + 1)));
      t += 3;
    }
    const p3 = await viewPart(db, token, at(T0, min(t)));
    expect(p3.questions[2].prompt).toContain('como Legal Service Designer');
    expect(p3.questions[2].prompt).not.toContain('{{rol}}');
  });
});

describe('selección múltiple', () => {
  it('el orden de opciones es una permutación fija por candidato', async () => {
    const { id, token } = await startedAttempt(db);
    let t = 1;
    for (const part of ['1A', '1B'] as const) {
      const p = await viewPart(db, token, at(T0, min(t)));
      await submitPart(db, token, part, fillAnswers(p), undefined, at(T0, min(t + 1)));
      t += 3;
    }
    const first = await viewPart(db, token, at(T0, min(t)));
    const second = await viewPart(db, token, at(T0, min(t + 5)));
    expect(first.questions).toHaveLength(12);
    for (const q of first.questions) expect(q.options).toHaveLength(4);
    expect(second.questions.map((q) => q.options!.map((o) => o.id))).toEqual(first.questions.map((q) => q.options!.map((o) => o.id)));
    // Es una permutación de las opciones de la base.
    const q = first.questions[0];
    const { variant } = await variantOf(db, id);
    const original = (variant.questions as { id: string; options?: { id: string }[] }[]).find((x) => x.id === q.id)!.options!;
    expect(q.options!.map((o) => o.id).sort()).toEqual(original.map((o) => o.id).sort());
  });

  it('rechaza una opción que no pertenece a la pregunta', async () => {
    const { token } = await startedAttempt(db);
    let t = 1;
    for (const part of ['1A', '1B'] as const) {
      const p = await viewPart(db, token, at(T0, min(t)));
      await submitPart(db, token, part, fillAnswers(p), undefined, at(T0, min(t + 1)));
      t += 3;
    }
    const p2 = await viewPart(db, token, at(T0, min(t)));
    const code2 = await code(saveAnswers(db, token, '2', [{ questionId: p2.questions[0].id, optionId: p2.questions[1].options![0].id }], undefined, at(T0, min(t + 1))));
    expect(code2).toBe('bad_answer');
  });
});

describe('registro de apertura del enlace', () => {
  it('guarda la primera apertura una sola vez, antes de que inicie la prueba', async () => {
    const inv = await invite(db);
    expect((await db.get(`invitations/${inv.id}`))!.openedAt).toBeNull();
    await getAttemptView(db, inv.token, at(T0, min(5)));
    await getAttemptView(db, inv.token, at(T0, min(9)));
    const doc = (await db.get(`invitations/${inv.id}`))!;
    expect(doc.openedAt).toBe(at(T0, min(5)).toISOString()); // la primera, no la última
    expect(doc.startedAt).toBeNull(); // abrir no inicia el reloj
  });

  it('un enlace regenerado vuelve a contar como "sin abrir"', async () => {
    const { regenerateLink } = await import('@/server/invitations');
    const inv = await invite(db);
    await getAttemptView(db, inv.token, at(T0, min(5)));
    await regenerateLink(db, inv.id, 'admin@haptica.co', at(T0, min(6)));
    expect((await db.get(`invitations/${inv.id}`))!.openedAt).toBeNull();
  });
});
