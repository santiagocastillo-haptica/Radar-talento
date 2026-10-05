import { describe, expect, it } from 'vitest';
import { countWords } from '@/lib/words';
import { formatClock, makeSync, remainingMs } from '@/lib/clock';
import { summarizeSignals, type SignalRow } from '@/lib/signals';

describe('countWords', () => {
  it('cuenta palabras separadas por cualquier espacio', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('uno')).toBe(1);
    expect(countWords('  uno   dos\ntres\tcuatro ')).toBe(4);
    expect(countWords('¿Qué cambia? Sí.')).toBe(3);
  });
});

describe('reloj del cliente', () => {
  const deadline = '2026-10-05T15:30:00.000Z';

  it('el tiempo restante sale de la hora del servidor y de un reloj monótono, no del reloj del computador', () => {
    // Servidor: 14:00:00. El cliente sincroniza con RTT de 200 ms.
    const sync = makeSync('2026-10-05T14:00:00.000Z', 1000, 1200);
    expect(remainingMs(deadline, sync, 1200)).toBe(90 * 60_000 - 100);
    // Pasan 10 minutos reales (monótonos). Aunque el usuario cambie la hora del sistema, Date.now() no interviene.
    const realDateNow = Date.now;
    Date.now = () => Date.parse('2030-01-01T00:00:00Z');
    try {
      expect(remainingMs(deadline, sync, 1200 + 10 * 60_000)).toBe(80 * 60_000 - 100);
    } finally {
      Date.now = realDateNow;
    }
  });

  it('no baja de cero y formatea', () => {
    const sync = makeSync('2026-10-05T16:00:00.000Z', 0, 0);
    expect(remainingMs(deadline, sync, 0)).toBe(0);
    expect(formatClock(90 * 60_000)).toBe('1:30:00');
    expect(formatClock(59_001)).toBe('01:00');
    expect(formatClock(0)).toBe('00:00');
  });
});

describe('resumen de señales', () => {
  const t0 = Date.parse('2026-10-05T14:00:00Z');
  const row = (p: Partial<SignalRow> & Pick<SignalRow, 'kind'>, s: number): SignalRow => ({
    part: '1A',
    questionId: '1',
    at: new Date(t0 + s * 1000),
    a: 0,
    b: 0,
    ...p,
  });

  it('cuenta pegados, salidas de pestaña y tiempo fuera', () => {
    const s = summarizeSignals([
      row({ kind: 'paste', a: 400 }, 10),
      row({ kind: 'paste', a: 100, questionId: '2' }, 20),
      row({ kind: 'blur_start', questionId: null }, 30),
      row({ kind: 'blur_end', questionId: null, a: 45_000 }, 75),
    ]);
    expect(s.total).toMatchObject({ pasteCount: 2, pasteChars: 500, blurCount: 1, blurMs: 45_000 });
    expect(s.perQuestion['1']).toEqual({ pasteCount: 1, pasteChars: 400 });
  });

  it('detecta ráfagas de texto largas y no marca la escritura normal', () => {
    const slow = summarizeSignals([
      row({ kind: 'save', a: 60, b: 10 }, 5),
      row({ kind: 'save', a: 130, b: 22 }, 10),
      row({ kind: 'save', a: 200, b: 33 }, 15),
    ]);
    expect(slow.bursts).toHaveLength(0);

    const burst = summarizeSignals([
      row({ kind: 'save', a: 60, b: 10 }, 5),
      row({ kind: 'save', a: 900, b: 150 }, 10), // +840 caracteres en 5 s
    ]);
    expect(burst.bursts).toHaveLength(1);
    expect(burst.bursts[0].deltaChars).toBe(840);
    expect(burst.perPart['1A'].bursts).toBe(1);
    expect(burst.timeline['1']).toHaveLength(2);
  });

  it('un primer autoguardado ya largo cuenta como ráfaga (texto completo en < 5 s)', () => {
    const s = summarizeSignals([row({ kind: 'save', a: 700, b: 110 }, 5)]);
    expect(s.bursts).toHaveLength(1);
  });
});


import { isSameOrigin } from '@/server/origin';

describe('comprobación de mismo origen (CSRF)', () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
  it('acepta el mismo sitio y rechaza otros, sin fallar con Origin: null', () => {
    expect(isSameOrigin(h({ 'sec-fetch-site': 'same-origin', origin: 'null' }))).toBe(true); // formulario con no-referrer
    expect(isSameOrigin(h({ 'sec-fetch-site': 'none' }))).toBe(true);
    expect(isSameOrigin(h({ 'sec-fetch-site': 'cross-site', origin: 'https://malo.com' }))).toBe(false);
    expect(isSameOrigin(h({ 'sec-fetch-site': 'same-site' }))).toBe(false);
    expect(isSameOrigin(h({ origin: 'null' }))).toBe(false); // sin Sec-Fetch-Site no se confía en "null"
    expect(isSameOrigin(h({ origin: 'https://radar.vercel.app', host: 'radar.vercel.app' }))).toBe(true);
    expect(isSameOrigin(h({ origin: 'https://otro.com', host: 'radar.vercel.app' }))).toBe(false);
    expect(isSameOrigin(h({ origin: 'no es url', host: 'radar.vercel.app' }))).toBe(false);
    expect(isSameOrigin(h({}))).toBe(true); // herramientas que no son navegador
  });
});
