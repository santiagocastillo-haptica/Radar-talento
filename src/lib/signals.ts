import type { PartId } from '@/content/types';

/**
 * Resumen de señales para el panel. Son BANDERAS para la entrevista, nunca motivo automático de descarte.
 * No se usa fingerprinting, grabación de pantalla, cámara ni micrófono.
 */

export interface SignalRow {
  part: PartId;
  questionId: string | null;
  kind: 'paste' | 'blur_start' | 'blur_end' | 'save';
  at: Date;
  a: number;
  b: number;
}

/** Ráfaga: aumento de texto demasiado rápido para haberse escrito a mano entre dos autoguardados. */
export const BURST_MIN_CHARS = 200;
export const BURST_MIN_CHARS_PER_SECOND = 15; // ≈ 180 palabras/min sostenidas
export const FIRST_SAVE_ASSUMED_GAP_SECONDS = 5; // el primer autoguardado ocurre ≤ ~5 s después de empezar a escribir

export interface Burst {
  part: PartId;
  questionId: string;
  at: string;
  deltaChars: number;
  seconds: number;
}

export interface PartSignals {
  pasteCount: number;
  pasteChars: number;
  blurCount: number;
  blurMs: number;
  bursts: number;
}

export interface SignalSummary {
  perPart: Record<PartId, PartSignals>;
  perQuestion: Record<string, { pasteCount: number; pasteChars: number }>;
  total: PartSignals;
  bursts: Burst[];
  /** Línea de tiempo de edición por pregunta: marca de tiempo (servidor) y tamaño del campo. Sin contenido. */
  timeline: Record<string, { at: string; chars: number; words: number }[]>;
}

const emptyPart = (): PartSignals => ({ pasteCount: 0, pasteChars: 0, blurCount: 0, blurMs: 0, bursts: 0 });

export function summarizeSignals(rows: SignalRow[]): SignalSummary {
  const parts: PartId[] = ['1A', '1B', '2', '3'];
  const perPart = Object.fromEntries(parts.map((p) => [p, emptyPart()])) as Record<PartId, PartSignals>;
  const perQuestion: SignalSummary['perQuestion'] = {};
  const timeline: SignalSummary['timeline'] = {};
  const bursts: Burst[] = [];
  const sorted = [...rows].sort((x, y) => x.at.getTime() - y.at.getTime());
  const lastSave = new Map<string, { at: Date; chars: number }>();

  for (const r of sorted) {
    const p = perPart[r.part];
    if (!p) continue;
    if (r.kind === 'paste') {
      p.pasteCount += 1;
      p.pasteChars += r.a;
      if (r.questionId != null) {
        const q = (perQuestion[r.questionId] ??= { pasteCount: 0, pasteChars: 0 });
        q.pasteCount += 1;
        q.pasteChars += r.a;
      }
    } else if (r.kind === 'blur_start') {
      p.blurCount += 1;
    } else if (r.kind === 'blur_end') {
      p.blurMs += r.a;
    } else if (r.kind === 'save' && r.questionId != null) {
      (timeline[r.questionId] ??= []).push({ at: r.at.toISOString(), chars: r.a, words: r.b });
      const prev = lastSave.get(r.questionId);
      const prevChars = prev?.chars ?? 0;
      const seconds = prev ? Math.max(1, (r.at.getTime() - prev.at.getTime()) / 1000) : FIRST_SAVE_ASSUMED_GAP_SECONDS;
      const delta = r.a - prevChars;
      if (delta >= BURST_MIN_CHARS && delta / seconds >= BURST_MIN_CHARS_PER_SECOND) {
        bursts.push({ part: r.part, questionId: r.questionId, at: r.at.toISOString(), deltaChars: delta, seconds: Math.round(seconds) });
        p.bursts += 1;
      }
      lastSave.set(r.questionId, { at: r.at, chars: r.a });
    }
  }

  const total = emptyPart();
  for (const p of parts) {
    total.pasteCount += perPart[p].pasteCount;
    total.pasteChars += perPart[p].pasteChars;
    total.blurCount += perPart[p].blurCount;
    total.blurMs += perPart[p].blurMs;
    total.bursts += perPart[p].bursts;
  }
  return { perPart, perQuestion, total, bursts, timeline };
}
