import { MemoryStore, type Store } from '@/server/store';
import { seedContent } from '@/server/seed';
import { createInvitation } from '@/server/invitations';
import { getAttemptView, startAttempt } from '@/server/attempt';
import type { AttemptView, PartView } from '@/lib/api-types';
import type { Role } from '@/content/types';

export const T0 = new Date('2026-10-05T14:00:00.000Z');
export const min = (n: number) => n * 60_000;
export const at = (base: Date, ms: number) => new Date(base.getTime() + ms);

/** Almacén en memoria con las mismas reglas de transacción que Firestore, ya sembrado. */
export async function freshDb(): Promise<Store> {
  const store = new MemoryStore();
  await seedContent(store);
  return store;
}

export async function invite(db: Store, role: Role = 'service_designer', now = T0) {
  return createInvitation(db, { name: 'Ana Prueba', email: 'ana@example.com', role, actor: 'tester@haptica.co' }, now);
}

export async function startedAttempt(db: Store, role: Role = 'service_designer', now = T0) {
  const inv = await invite(db, role, now);
  const view = await startAttempt(db, inv.token, true, now);
  return { ...inv, view };
}

export function partOf(view: AttemptView): PartView {
  if (view.status !== 'en_curso') throw new Error(`se esperaba en_curso, llegó ${view.status}`);
  return view.part;
}

export async function viewPart(db: Store, token: string, now: Date) {
  return partOf(await getAttemptView(db, token, now));
}

/** Respuestas válidas para todas las preguntas de una parte (abiertas con N palabras; MC con la primera opción). */
export function fillAnswers(part: PartView, words = 5) {
  return part.questions.map((q) =>
    q.kind === 'open'
      ? { questionId: q.id, text: Array.from({ length: words }, (_, i) => `palabra${i}`).join(' ') }
      : { questionId: q.id, optionId: q.options![0].id },
  );
}

/** Variante asignada a una invitación (para leer opciones/clave en las pruebas). */
export async function variantOf(db: Store, invitationId: string) {
  const inv = await db.get(`invitations/${invitationId}`);
  const variant = (await db.get(`variants/${inv!.variant}`))!;
  const keys = (await db.get(`variantKeys/${inv!.variant}`))!.keys as Record<string, { correctOptionId: string; skill: string }>;
  return { slug: inv!.variant as string, variant, keys };
}
