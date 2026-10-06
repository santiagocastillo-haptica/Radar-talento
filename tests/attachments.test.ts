import { beforeAll, describe, expect, it } from 'vitest';
import type { Store } from '@/server/store';
import { AppError, getAttemptView, getOwnAttachment, saveAnswers, setAttachment, sniffImage, submitPart, MAX_IMAGE_BYTES } from '@/server/attempt';
import { deleteInvitation } from '@/server/invitations';
import { getAttachmentForAdmin, getCandidateDetail } from '@/server/review';
import { retireOldVariants, seedContent } from '@/server/seed';
import { at, fillAnswers, freshDb, min, startedAttempt, T0, viewPart } from './helpers';

let db: Store;
beforeAll(async () => {
  db = await freshDb();
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof AppError ? e.code : `otro: ${(e as Error).message}`;
  }
  return 'no_error';
};

// PNG válido de 1×1 y bytes con firma JPEG/WebP
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const b64 = (b: Buffer) => b.toString('base64');
const JPEG = b64(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]));
const WEBP = b64(Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(20, 2)]));

describe('contenido ajustado (documento de Háptica)', () => {
  it('Service Designer: preguntas, límites y giro nuevos; ninguna pregunta del caso anterior', async () => {
    const { token } = await startedAttempt(db, 'service_designer');
    const p = await viewPart(db, token, at(T0, min(1)));
    expect(p.questions.map((q) => [q.label, q.wordLimit, q.allowImage])).toEqual([
      ['Hipótesis', 200, true],
      ['Investigación', 200, true],
      ['Resultados', 100, true],
    ]);
    expect(p.questions[2].prompt).toContain('para la Aseguradora');
    expect(p.suggestedMinutes).toBe(30);
    const ctx = JSON.stringify(p.caseContext);
    expect(ctx).toContain('de 31% a 60%');
    expect(ctx).not.toContain('squad de desarrollo'); // la restricción se eliminó
    await submitPart(db, token, '1A', fillAnswers(p), undefined, at(T0, min(5)));
    const p1b = await viewPart(db, token, at(T0, min(6)));
    expect(JSON.stringify(p1b.twist)).toContain('una semana para actividades presenciales y otra solo para actividades virtuales');
    expect(p1b.questions.map((q) => [q.wordLimit, q.allowImage])).toEqual([
      [200, true],
      [100, false],
    ]);
  });

  it('Legal Service Designer: sin el dato de 9 segundos ni restricciones, y con el giro del "audio contrato"', async () => {
    const { token } = await startedAttempt(db, 'legal_service_designer');
    const p = await viewPart(db, token, at(T0, min(1)));
    const ctx = JSON.stringify(p.caseContext);
    expect(ctx).not.toContain('9 segundos');
    expect(ctx).not.toContain('Restricciones');
    expect(p.suggestedMinutes).toBe(25);
    expect(p.questions[2].prompt).toContain('para la cooperativa');
    await submitPart(db, token, '1A', fillAnswers(p), undefined, at(T0, min(5)));
    const p1b = await viewPart(db, token, at(T0, min(6)));
    expect(JSON.stringify(p1b.twist)).toContain('audio contrato');
    expect(p1b.questions.map((q) => [q.wordLimit, q.allowImage])).toEqual([
      [200, false],
      [80, false],
    ]);
  });

  it('Parte 3: una sola pregunta abierta (la de la autoría), con imagen opcional', async () => {
    const { token } = await startedAttempt(db);
    let t = 1;
    for (const part of ['1A', '1B', '2'] as const) {
      const p = await viewPart(db, token, at(T0, min(t)));
      await submitPart(db, token, part, fillAnswers(p), undefined, at(T0, min(t + 1)));
      t += 3;
    }
    const p3 = await viewPart(db, token, at(T0, min(t)));
    expect(p3.questions).toHaveLength(1);
    expect(p3.questions[0].allowImage).toBe(true);
    expect(p3.questions[0].prompt).toContain('¿en qué momento un entregable deja de reflejar el criterio del diseñador');
    expect(p3.questions[0].prompt).toContain('rol del diseñador como "autor"');
    expect(p3.intro).toEqual([]); // sin la introducción anterior (ya no aplica)
  });
});

describe('versiones del contenido', () => {
  it('las variantes que ya no están en el contenido vigente se retiran sin borrarlas', async () => {
    const s = await freshDb();
    await s.set('variants/sd-renovacion-polizas', { slug: 'sd-renovacion-polizas', role: 'service_designer', active: true, name: 'vieja' });
    expect(await retireOldVariants(s)).toEqual(['sd-renovacion-polizas']);
    expect((await s.get('variants/sd-renovacion-polizas'))!.active).toBe(false);
    expect((await s.get('variants/sd-renovacion-polizas-v3'))!.active).toBe(true);
    // Las invitaciones nuevas solo reciben variantes activas.
    const { id } = await startedAttempt(s, 'service_designer');
    expect((await s.get(`invitations/${id}`))!.variant).toBe('sd-renovacion-polizas-v3');
    // Reejecutar el seed no reactiva la vieja.
    await seedContent(s);
    expect((await s.get('variants/sd-renovacion-polizas'))!.active).toBe(false);
  });
});

describe('imagen adjunta opcional', () => {
  async function inPart1A() {
    const c = await startedAttempt(db);
    const p = await viewPart(db, c.token, at(T0, min(1)));
    return { ...c, p, q: p.questions[0] };
  }

  it('reconoce el tipo real por los bytes (no por lo que declare el cliente)', () => {
    expect(sniffImage(Buffer.from(PNG, 'base64'))).toBe('image/png');
    expect(sniffImage(Buffer.from(JPEG, 'base64'))).toBe('image/jpeg');
    expect(sniffImage(Buffer.from(WEBP, 'base64'))).toBe('image/webp');
    expect(sniffImage(Buffer.from('<svg onload=alert(1)></svg>'))).toBeNull();
    expect(sniffImage(Buffer.from('GIF89a' + 'x'.repeat(30)))).toBeNull();
    expect(sniffImage(Buffer.alloc(5))).toBeNull();
  });

  it('adjunta, aparece en la vista, la propia persona la recupera y se puede reemplazar o quitar', async () => {
    const { id, token, q } = await inPart1A();
    const r = await setAttachment(db, token, '1A', q.id, { base64: PNG }, at(T0, min(2)));
    expect(r).toMatchObject({ attached: true, mime: 'image/png' });

    const v = await viewPart(db, token, at(T0, min(3)));
    expect(v.saved[q.id].image).toMatchObject({ mime: 'image/png' });
    expect(JSON.stringify(v)).not.toContain(PNG); // la vista solo lleva metadatos, nunca los bytes

    const own = await getOwnAttachment(db, token, q.id);
    expect(own.mime).toBe('image/png');
    expect(own.bytes.equals(Buffer.from(PNG, 'base64'))).toBe(true);

    await setAttachment(db, token, '1A', q.id, { base64: JPEG }, at(T0, min(4))); // reemplazo
    expect((await getOwnAttachment(db, token, q.id)).mime).toBe('image/jpeg');

    await setAttachment(db, token, '1A', q.id, null, at(T0, min(5)));
    expect((await viewPart(db, token, at(T0, min(6)))).saved[q.id]?.image).toBeUndefined();
    expect(await code(getOwnAttachment(db, token, q.id))).toBe('not_found');
    expect(await db.query(`invitations/${id}/attachments`)).toHaveLength(0);
  });

  it('valida: pregunta sin imagen, parte inactiva, bytes inválidos, tamaño y límite de imágenes', async () => {
    const { token, q } = await inPart1A();
    expect(await code(setAttachment(db, token, '1B', q.id, { base64: PNG }, at(T0, min(2))))).toBe('wrong_part');
    expect(await code(setAttachment(db, token, '1A', 'no-existe', { base64: PNG }, at(T0, min(2))))).toBe('bad_question');
    expect(await code(setAttachment(db, token, '1A', q.id, { base64: b64(Buffer.from('<svg></svg>'.repeat(5))) }, at(T0, min(2))))).toBe('bad_image');
    expect(await code(setAttachment(db, token, '1A', q.id, { base64: 'no es base64!!' }, at(T0, min(2))))).toBe('bad_image');
    const big = b64(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(MAX_IMAGE_BYTES + 10, 7)]));
    expect(await code(setAttachment(db, token, '1A', q.id, { base64: big }, at(T0, min(2))))).toBe('image_too_large');
  });

  it('una pregunta que no admite imagen (ítem de la Parte 2 o campo sin imagen) la rechaza', async () => {
    const { token } = await startedAttempt(db, 'legal_service_designer');
    let t = 1;
    const p1a = await viewPart(db, token, at(T0, min(t)));
    await submitPart(db, token, '1A', fillAnswers(p1a), undefined, at(T0, min(t + 1)));
    const p1b = await viewPart(db, token, at(T0, min(t + 2)));
    // En la variante LSD el campo 4 de 1B no admite imagen.
    expect(await code(setAttachment(db, token, '1B', p1b.questions[0].id, { base64: PNG }, at(T0, min(t + 3))))).toBe('no_image_allowed');
  });

  it('respeta el reloj: no se adjunta fuera de tiempo', async () => {
    const { token, q } = await inPart1A();
    expect(await code(setAttachment(db, token, '1A', q.id, { base64: PNG }, at(T0, min(90) + 11_000)))).toBe('expired');
    expect(await code(setAttachment(db, token, '1A', q.id, { base64: PNG }, at(T0, min(90) + 5_000)))).toBe('no_error'); // dentro de la gracia
  });

  it('el panel ve la imagen y los metadatos; eliminar la invitación también borra la imagen', async () => {
    const { id, token, q } = await inPart1A();
    await saveAnswers(db, token, '1A', [{ questionId: q.id, text: 'mi respuesta' }], undefined, at(T0, min(2)));
    await setAttachment(db, token, '1A', q.id, { base64: PNG }, at(T0, min(3)));

    const detail = await getCandidateDetail(db, id, at(T0, min(4)));
    const question = detail!.parts.find((p) => p.id === '1A')!.questions[0];
    expect(question.image).toMatchObject({ mime: 'image/png' });
    expect((await getAttachmentForAdmin(db, id, q.id))!.bytes.equals(Buffer.from(PNG, 'base64'))).toBe(true);
    expect(await getAttachmentForAdmin(db, id, 'otra')).toBeNull();
    expect(await getAttachmentForAdmin(db, 'no-es-un-id', q.id)).toBeNull();

    await deleteInvitation(db, id, 'admin@haptica.co', 'prueba de borrado', 'Ana Prueba', at(T0, min(5)));
    expect(await db.query(`invitations/${id}/attachments`)).toHaveLength(0);
    expect(await getAttachmentForAdmin(db, id, q.id)).toBeNull();
    expect(await code(getAttemptView(db, token, at(T0, min(6))))).toBe('invalid_token');
  });
});
