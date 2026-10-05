import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@/server/store';

describe('MemoryStore (misma semántica que Firestore)', () => {
  it('consultas con filtro, orden y límite; subcolecciones no se mezclan', async () => {
    const s = new MemoryStore();
    await s.set('a/1', { n: 3, k: 'x' });
    await s.set('a/2', { n: 1, k: 'x' });
    await s.set('a/3', { n: 2, k: 'y' });
    await s.set('a/1/sub/9', { n: 99 });
    expect((await s.query('a', { where: [['k', '==', 'x']], orderBy: ['n', 'asc'] })).map((d) => d.id)).toEqual(['2', '1']);
    expect((await s.query('a', { orderBy: ['n', 'desc'], limit: 2 })).map((d) => d.id)).toEqual(['1', '3']);
    expect(await s.query('a/1/sub')).toHaveLength(1);
    expect(await s.query('a')).toHaveLength(3);
  });

  it('merge es profundo y null borra al leer; los arreglos se reemplazan', async () => {
    const s = new MemoryStore();
    await s.merge('d/1', { m: { a: 1 }, arr: [1, 2] });
    await s.merge('d/1', { m: { b: 2 }, arr: [3] });
    expect(await s.get('d/1')).toEqual({ m: { a: 1, b: 2 }, arr: [3] });
  });

  it('una transacción que falla no deja escrituras a medias', async () => {
    const s = new MemoryStore();
    await s.set('d/1', { v: 1 });
    await expect(
      s.tx(async (t) => {
        await t.get('d/1');
        await t.set('d/1', { v: 2 });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect((await s.get('d/1'))!.v).toBe(1);
  });

  it('leer después de escribir dentro de una transacción falla, como en Firestore', async () => {
    const s = new MemoryStore();
    await expect(
      s.tx(async (t) => {
        await t.set('d/1', { v: 1 });
        await t.get('d/1');
      }),
    ).rejects.toThrow(/lecturas deben ir antes/);
  });

  it('las transacciones concurrentes se serializan (sin perder actualizaciones)', async () => {
    const s = new MemoryStore();
    await s.set('c/1', { n: 0 });
    await Promise.all(
      Array.from({ length: 20 }, () =>
        s.tx(async (t) => {
          const d = await t.get('c/1');
          await t.set('c/1', { n: d!.n + 1 });
        }),
      ),
    );
    expect((await s.get('c/1'))!.n).toBe(20);
  });
});

import { parseServiceAccount } from '@/server/store';

describe('parseServiceAccount', () => {
  const sa = { type: 'service_account', project_id: 'p', private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n', client_email: 'x@p.iam.gserviceaccount.com' };
  const json = JSON.stringify(sa, null, 2);

  it('acepta JSON, base64, y variantes de pegado (BOM, comillas, UTF-16)', () => {
    expect(parseServiceAccount(json).client_email).toBe(sa.client_email);
    expect(parseServiceAccount('﻿' + json).client_email).toBe(sa.client_email);
    expect(parseServiceAccount(`"${JSON.stringify(sa)}"`).client_email).toBe(sa.client_email);
    expect(parseServiceAccount(Buffer.from(json).toString('base64')).client_email).toBe(sa.client_email);
    expect(parseServiceAccount(Buffer.from(json, 'utf16le').toString('base64')).client_email).toBe(sa.client_email);
    const wrapped = Buffer.from(json).toString('base64').replace(/(.{60})/g, '$1\n');
    expect(parseServiceAccount(wrapped).client_email).toBe(sa.client_email);
  });

  it('rechaza basura sin filtrar el contenido en el mensaje', () => {
    expect(() => parseServiceAccount('SECRETO-que-no-es-json')).toThrow(/no es el JSON de una cuenta de servicio/);
    try {
      parseServiceAccount('SECRETO-que-no-es-json');
    } catch (e) {
      expect((e as Error).message).not.toContain('SECRETO');
    }
  });
});
