import type { Block, PartId, Role } from '@/content/types';
import type { Data, Reader } from './store';

/** Forma de los documentos y sus conversiones. Las fechas se guardan como texto ISO-8601 (UTC). */

export interface VariantQuestion {
  id: string; // estable dentro de la variante: "<parte>-<número>"
  part: PartId;
  number: number;
  kind: 'open' | 'mc';
  label: string | null;
  prompt: string;
  wordLimit: number | null;
  /** Opciones en el orden original del seed (sin barajar). Sin marca de correcta: la clave vive en variantKeys. */
  options?: { id: string; text: string }[];
}

export interface VariantPart {
  part: PartId;
  title: string;
  intro: Block[];
  outro: string | null;
  suggestedMinutes: number;
  groupWordLimit: number | null;
}

export interface VariantDoc {
  slug: string;
  role: Role;
  name: string;
  active: boolean;
  caseTitle: string;
  caseContext: Block[];
  twist: Block[];
  parts: VariantPart[];
  questions: VariantQuestion[];
}

/** Clave de respuestas: documento aparte, que solo leen el panel del evaluador y la calificación. */
export interface VariantKeysDoc {
  keys: Record<string, { correctOptionId: string; skill: string }>;
}

export interface InvRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  variant: string; // slug
  tokenHash: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  termsAcceptedAt: Date | null;
  startedAt: Date | null;
  deadlineAt: Date | null;
  finishedAt: Date | null;
  closedAt: Date | null;
  closedReason: 'submitted' | 'expired' | null;
  clockResets: number;
  submitted: Partial<Record<PartId, Date>>;
  optionOrders: Record<string, string[]>;
  signalCount: number;
  evaluations: Record<string, { status: string; by: string; at: string } | null>;
  notes: Record<string, { note: string; by: string; at: string } | null>;
}

const d = (v: unknown): Date | null => (typeof v === 'string' ? new Date(v) : null);

export function toInv(id: string, x: Data): InvRow {
  const submitted: InvRow['submitted'] = {};
  for (const [k, v] of Object.entries(x.submitted ?? {})) if (v) submitted[k as PartId] = new Date(v as string);
  return {
    id,
    name: x.name,
    email: x.email,
    role: x.role,
    variant: x.variant,
    tokenHash: x.tokenHash,
    createdBy: x.createdBy,
    createdAt: new Date(x.createdAt),
    expiresAt: new Date(x.expiresAt),
    termsAcceptedAt: d(x.termsAcceptedAt),
    startedAt: d(x.startedAt),
    deadlineAt: d(x.deadlineAt),
    finishedAt: d(x.finishedAt),
    closedAt: d(x.closedAt),
    closedReason: x.closedReason ?? null,
    clockResets: x.clockResets ?? 0,
    submitted,
    optionOrders: x.optionOrders ?? {},
    signalCount: x.signalCount ?? 0,
    evaluations: x.evaluations ?? {},
    notes: x.notes ?? {},
  };
}

export const invPath = (id: string) => `invitations/${id}`;

export async function loadVariant(r: Reader, slug: string): Promise<VariantDoc> {
  const v = (await r.get(`variants/${slug}`)) as VariantDoc | null;
  if (!v) throw new Error(`Variante "${slug}" no encontrada (¿se ejecutó el seed?)`);
  return v;
}
