import type { Block, PartId } from '@/content/types';

/** Lo que el servidor entrega al candidato. Ninguno de estos tipos contiene clave de respuestas. */

export interface QuestionView {
  id: string;
  number: number;
  kind: 'open' | 'mc';
  label: string | null;
  prompt: string;
  wordLimit: number | null;
  /** Se puede adjuntar una imagen opcional. */
  allowImage: boolean;
  /** Solo en ítems de selección múltiple, ya barajadas para este candidato. Sin letra original ni marca de correcta. */
  options?: { id: string; text: string }[];
}

export interface SavedAnswer {
  text?: string;
  optionId?: string;
  /** Metadatos de la imagen adjunta (los bytes se piden aparte). */
  image?: { mime: string; size: number };
}

export interface PartView {
  id: PartId;
  title: string;
  intro: Block[];
  outro: string | null;
  suggestedMinutes: number;
  groupWordLimit: number | null;
  /** Hora (servidor) en que esta parte quedó activa: para el indicador orientativo de tiempo. */
  startedAt: string;
  /** Caso de la Parte 1 (en 1A y 1B). */
  caseTitle?: string;
  caseContext?: Block[];
  /** Giro: SOLO presente en la parte 1B, que solo se entrega con 1A enviada. */
  twist?: Block[];
  questions: QuestionView[];
  saved: Record<string, SavedAnswer>;
}

export type AttemptView =
  | { status: 'vencida'; serverNow: string; name: string }
  | {
      status: 'creada';
      serverNow: string;
      name: string;
      role: string;
      roleLabel: string;
      expiresAt: string;
      durationMinutes: number;
      rulesText: string;
      privacyUrl: string;
      parts: { id: PartId; title: string; suggestedMinutes: number }[];
    }
  | {
      status: 'en_curso';
      serverNow: string;
      name: string;
      startedAt: string;
      deadlineAt: string;
      part: PartView;
      doneParts: PartId[];
      partOrder: PartId[];
    }
  | { status: 'enviada' | 'expirada'; serverNow: string; name: string };

export interface AnswerInput {
  questionId: string;
  text?: string;
  optionId?: string;
}

export type SignalInput =
  | { kind: 'paste'; questionId: string; chars: number; ageMs?: number }
  | { kind: 'blur_start'; ageMs?: number }
  | { kind: 'blur_end'; ms: number; ageMs?: number };

export interface SaveResult {
  serverNow: string;
  deadlineAt: string;
  rejected: { questionId: string; code: 'over_limit' | 'over_group_limit' | 'too_long' }[];
}
