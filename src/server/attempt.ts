import { config } from './config';
import { hashToken, safeEqualHex, shuffle } from './tokens';
import { canWrite, computeStatus } from './status';
import { invPath, loadVariant, toInv, type InvRow, type VariantDoc } from './model';
import { newId, type Data, type Reader, type Store, type Tx } from './store';
import { countWords } from '@/lib/words';
import { PART_ORDER, ROLE_LABEL, type PartId } from '@/content/types';
import { RULES_TEXT } from '@/content/variants';
import type { AnswerInput, AttemptView, PartView, QuestionView, SaveResult, SavedAnswer, SignalInput } from '@/lib/api-types';

/**
 * Flujo del candidato. Reglas que se aplican AQUÍ (servidor), nunca solo en la interfaz:
 *  - el reloj es `deadlineAt` (fijado al iniciar); el estado se deriva de las marcas de tiempo;
 *  - solo se escribe en la parte activa, en orden y sin retroceso;
 *  - el texto de 1B no sale antes de enviar 1A;
 *  - la clave de la Parte 2 (variantKeys) no se consulta jamás desde este módulo.
 */

export class AppError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const MAX_TEXT_CHARS = 20000;
const MAX_SIGNAL_EVENTS_PER_INVITATION = 5000;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;

// ───────────────────────── Acceso por token ─────────────────────────

export async function findInvitationByToken(r: Reader, token: string): Promise<InvRow | null> {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const h = hashToken(token);
  const [hit] = await r.query('invitations', { where: [['tokenHash', '==', h]], limit: 1 });
  if (!hit) return null;
  const row = toInv(hit.id, hit.data);
  return safeEqualHex(row.tokenHash, h) ? row : null;
}

/** Si ya pasó el deadline y no se cerró, deja constancia (`expirada`). Idempotente; lo que se escribió se conserva. */
async function materializeExpiry(store: Store, inv: InvRow, now: Date): Promise<InvRow> {
  if (!(inv.startedAt && inv.deadlineAt && !inv.finishedAt && !inv.closedAt && now.getTime() > inv.deadlineAt.getTime())) return inv;
  await store.tx(async (t) => {
    const doc = await t.get(invPath(inv.id));
    if (!doc) return;
    const cur = toInv(inv.id, doc);
    if (cur.startedAt && cur.deadlineAt && !cur.finishedAt && !cur.closedAt && now.getTime() > cur.deadlineAt.getTime()) {
      await t.merge(invPath(inv.id), { closedAt: cur.deadlineAt.toISOString(), closedReason: 'expired' });
    }
  });
  const fresh = await store.get(invPath(inv.id));
  return fresh ? toInv(inv.id, fresh) : inv;
}

export { materializeExpiry };

async function loadInvitation(store: Store, token: string, now: Date): Promise<InvRow> {
  const inv = await findInvitationByToken(store, token);
  if (!inv) throw new AppError('invalid_token', 404, 'Enlace no válido');
  return materializeExpiry(store, inv, now);
}

const currentPartOf = (inv: InvRow): PartId | null => PART_ORDER.find((p) => !inv.submitted[p]) ?? null;

// ───────────────────────── Lectura ─────────────────────────

export async function getAttemptView(store: Store, token: string, now = new Date()): Promise<AttemptView> {
  let inv = await loadInvitation(store, token, now);
  if (!inv.openedAt) {
    // Primera apertura del enlace: el equipo ve que la persona ya accedió (aunque aún no empiece la prueba).
    await store.merge(invPath(inv.id), { openedAt: now.toISOString() });
    inv = { ...inv, openedAt: now };
  }
  return buildView(store, inv, now);
}

async function buildView(store: Store, inv: InvRow, now: Date): Promise<AttemptView> {
  const status = computeStatus(inv, now);
  const serverNow = now.toISOString();
  const cfg = config();

  if (status === 'vencida') return { status, serverNow, name: inv.name };

  if (status === 'creada') {
    const variant = await loadVariant(store, inv.variant);
    return {
      status,
      serverNow,
      name: inv.name,
      role: inv.role,
      roleLabel: ROLE_LABEL[inv.role],
      expiresAt: inv.expiresAt.toISOString(),
      durationMinutes: cfg.durationMinutes,
      rulesText: RULES_TEXT,
      privacyUrl: cfg.privacyPolicyUrl,
      parts: variant.parts.map((p) => ({ id: p.part, title: p.title, suggestedMinutes: p.suggestedMinutes })),
    };
  }

  if (status === 'enviada' || status === 'expirada') return { status, serverNow, name: inv.name };

  // en_curso: solo se entrega la parte ACTIVA. Nada de partes futuras.
  const partId = currentPartOf(inv);
  if (!partId) return { status: 'enviada', serverNow, name: inv.name };

  const prevIdx = PART_ORDER.indexOf(partId) - 1;
  const prevSubmitted = prevIdx >= 0 ? inv.submitted[PART_ORDER[prevIdx]] : undefined;
  const partStartedAt = new Date(Math.max(inv.startedAt!.getTime(), prevSubmitted?.getTime() ?? 0));

  return {
    status,
    serverNow,
    name: inv.name,
    startedAt: inv.startedAt!.toISOString(),
    deadlineAt: inv.deadlineAt!.toISOString(),
    part: await buildPartView(store, inv, partId, partStartedAt),
    doneParts: PART_ORDER.filter((p) => inv.submitted[p]),
    partOrder: PART_ORDER,
  };
}

/** Orden barajado de opciones por candidato, persistido. Si dos cargas compiten, gana la primera. */
async function ensureOptionOrders(store: Store, inv: InvRow, mc: { id: string; options?: { id: string }[] }[]): Promise<Record<string, string[]>> {
  if (mc.every((q) => inv.optionOrders[q.id])) return inv.optionOrders;
  return store.tx(async (t) => {
    const doc = await t.get(invPath(inv.id));
    const have: Record<string, string[]> = (doc?.optionOrders as Record<string, string[]>) ?? {};
    const add: Record<string, string[]> = {};
    for (const q of mc) if (!have[q.id]) add[q.id] = shuffle(q.options!.map((o) => o.id));
    if (Object.keys(add).length) await t.merge(invPath(inv.id), { optionOrders: add });
    return { ...have, ...add };
  });
}

async function buildPartView(store: Store, inv: InvRow, partId: PartId, startedAt: Date): Promise<PartView> {
  const variant = await loadVariant(store, inv.variant);
  const vp = variant.parts.find((p) => p.part === partId);
  if (!vp) throw new AppError('content_missing', 500, 'Contenido de la prueba no cargado (¿se ejecutó el seed?)');
  const qs = variant.questions.filter((q) => q.part === partId);

  const mc = qs.filter((q) => q.kind === 'mc');
  const orders = mc.length ? await ensureOptionOrders(store, inv, mc) : {};

  const roleLabel = ROLE_LABEL[inv.role];
  // Se construye campo por campo: nada de la clave ni de metadatos internos viaja al navegador.
  const questions: QuestionView[] = qs.map((q) => {
    const v: QuestionView = {
      id: q.id,
      number: q.number,
      kind: q.kind,
      label: q.label,
      prompt: q.prompt.replaceAll('{{rol}}', roleLabel),
      wordLimit: q.wordLimit,
    };
    if (q.kind === 'mc') {
      const byId = new Map(q.options!.map((o) => [o.id, o]));
      v.options = (orders[q.id] ?? []).map((id) => ({ id, text: byId.get(id)!.text }));
    }
    return v;
  });

  const saved: Record<string, SavedAnswer> = {};
  const ids = new Set(qs.map((q) => q.id));
  for (const a of await store.query(`${invPath(inv.id)}/answers`)) {
    if (ids.has(a.id)) saved[a.id] = { text: a.data.text ?? undefined, optionId: a.data.optionId ?? undefined };
  }

  const view: PartView = {
    id: partId,
    title: vp.title,
    intro: vp.intro,
    outro: vp.outro,
    suggestedMinutes: vp.suggestedMinutes,
    groupWordLimit: vp.groupWordLimit,
    startedAt: startedAt.toISOString(),
    questions,
    saved,
  };

  if (partId === '1A' || partId === '1B') {
    view.caseTitle = variant.caseTitle;
    view.caseContext = variant.caseContext;
    // El giro solo se entrega cuando la parte activa es 1B (es decir, 1A ya fue enviada).
    if (partId === '1B') view.twist = variant.twist;
  }
  return view;
}

// ───────────────────────── Escritura ─────────────────────────

export async function startAttempt(store: Store, token: string, accepted: boolean, now = new Date()): Promise<AttemptView> {
  if (accepted !== true) throw new AppError('terms_required', 422, 'Debes aceptar las reglas para comenzar');
  const found = await loadInvitation(store, token, now);
  await store.tx(async (t) => {
    const doc = await t.get(invPath(found.id));
    if (!doc) throw new AppError('invalid_token', 404, 'Enlace no válido');
    const inv = toInv(found.id, doc);
    if (!safeEqualHex(inv.tokenHash, hashToken(token))) throw new AppError('invalid_token', 404, 'Enlace no válido');
    const status = computeStatus(inv, now);
    if (status === 'en_curso') return; // idempotente: reabrir no reinicia el reloj
    if (status === 'vencida') throw new AppError('link_expired', 410, 'El enlace venció sin iniciar la prueba');
    if (status !== 'creada') throw new AppError('already_closed', 409, 'La prueba ya terminó');
    const deadline = new Date(now.getTime() + config().durationMinutes * 60_000);
    await t.merge(invPath(inv.id), {
      startedAt: now.toISOString(),
      deadlineAt: deadline.toISOString(),
      termsAcceptedAt: now.toISOString(),
    });
  });
  return getAttemptView(store, token, now);
}

interface Ctx {
  t: Tx;
  inv: InvRow;
  variant: VariantDoc;
  patch: Data;
  signalCount: number;
}

/**
 * Transacción con verificación de que se puede escribir ahora (hasta deadline + gracia).
 * Regla de Firestore: dentro de `fn` todas las lecturas van antes de las escrituras.
 */
async function withWritableAttempt<T>(store: Store, token: string, now: Date, fn: (c: Ctx, current: PartId) => Promise<T>): Promise<T> {
  const found = await loadInvitation(store, token, now); // deja constancia del vencimiento aunque luego se rechace
  return store.tx(async (t) => {
    const doc = await t.get(invPath(found.id));
    if (!doc) throw new AppError('invalid_token', 404, 'Enlace no válido');
    const inv = toInv(found.id, doc);
    if (!safeEqualHex(inv.tokenHash, hashToken(token))) throw new AppError('invalid_token', 404, 'Enlace no válido');
    if (!inv.startedAt) throw new AppError('not_started', 409, 'La prueba no ha iniciado');
    if (inv.finishedAt) throw new AppError('finished', 409, 'La prueba ya fue enviada');
    if (!canWrite(inv, now)) throw new AppError('expired', 409, 'El tiempo terminó: la prueba se cerró con lo que estaba guardado');
    const current = currentPartOf(inv);
    if (!current) throw new AppError('finished', 409, 'La prueba ya fue enviada');
    const variant = await loadVariant(t, inv.variant);
    const ctx: Ctx = { t, inv, variant, patch: {}, signalCount: inv.signalCount };
    const out = await fn(ctx, current);
    if (ctx.signalCount !== inv.signalCount) ctx.patch.signalCount = ctx.signalCount;
    if (Object.keys(ctx.patch).length) await t.merge(invPath(inv.id), ctx.patch);
    return out;
  });
}

function assertActivePart(requested: PartId, current: PartId) {
  if (!PART_ORDER.includes(requested)) throw new AppError('bad_part', 422, 'Parte desconocida');
  if (requested !== current) {
    throw new AppError('wrong_part', 409, 'Esa parte no está activa (las partes se responden en orden y no se puede volver atrás)', {
      currentPart: current,
    });
  }
}

async function addEvent(c: Ctx, part: string, questionId: string | null, kind: string, at: Date, a: number, b = 0) {
  if (c.signalCount >= MAX_SIGNAL_EVENTS_PER_INVITATION) return;
  c.signalCount += 1;
  await c.t.set(`${invPath(c.inv.id)}/signals/${newId()}`, {
    part,
    questionId,
    kind,
    at: at.toISOString(),
    a: Math.max(0, Math.round(a)),
    b: Math.max(0, Math.round(b)),
  });
}

async function applyAnswers(c: Ctx, part: PartId, answers: AnswerInput[], now: Date): Promise<SaveResult['rejected']> {
  const qs = c.variant.questions.filter((q) => q.part === part);
  const qMap = new Map(qs.map((q) => [q.id, q]));
  const vp = c.variant.parts.find((p) => p.part === part);

  // ── lecturas ──
  const existing = await c.t.query(`${invPath(c.inv.id)}/answers`);
  const currentText = new Map<string, string>(existing.map((e) => [e.id, (e.data.text as string | undefined) ?? '']));

  // ── validación (sin E/S) ──
  const rejected: SaveResult['rejected'] = [];
  const open: { q: (typeof qs)[number]; text: string }[] = [];
  const mcs: { q: (typeof qs)[number]; optionId: string }[] = [];
  const last = new Map<string, AnswerInput>(); // si llegan varias para la misma pregunta, vale la última
  for (const a of answers) last.set(a.questionId, a);

  for (const a of last.values()) {
    const q = qMap.get(a.questionId);
    if (!q) throw new AppError('bad_question', 422, 'Pregunta que no pertenece a la parte activa');
    if (q.kind === 'open') {
      if (typeof a.text !== 'string') throw new AppError('bad_answer', 422, 'Respuesta de texto inválida');
      if (a.text.length > MAX_TEXT_CHARS) rejected.push({ questionId: q.id, code: 'too_long' });
      else if (q.wordLimit && countWords(a.text) > q.wordLimit) rejected.push({ questionId: q.id, code: 'over_limit' });
      else open.push({ q, text: a.text });
    } else {
      if (typeof a.optionId !== 'string' || !q.options!.some((o) => o.id === a.optionId)) {
        throw new AppError('bad_answer', 422, 'Opción que no pertenece a la pregunta');
      }
      mcs.push({ q, optionId: a.optionId });
    }
  }

  // Límite compartido (Parte 3): suma de palabras de todos los campos de la parte.
  if (vp?.groupWordLimit) {
    const merged = new Map(currentText);
    for (const { q, text } of open) merged.set(q.id, text);
    let total = 0;
    for (const q of qs) if (q.kind === 'open') total += countWords(merged.get(q.id));
    if (total > vp.groupWordLimit) {
      for (const { q } of open) rejected.push({ questionId: q.id, code: 'over_group_limit' });
      open.length = 0;
    }
  }

  // ── escrituras ──
  const base = `${invPath(c.inv.id)}/answers`;
  for (const { q, optionId } of mcs) {
    await c.t.set(`${base}/${q.id}`, { optionId, updatedAt: now.toISOString() });
  }
  for (const { q, text } of open) {
    await c.t.set(`${base}/${q.id}`, { text, updatedAt: now.toISOString() });
    if (text !== (currentText.get(q.id) ?? '')) {
      // Línea de tiempo de edición medida por el servidor: marca de tiempo + tamaño (no el contenido).
      await addEvent(c, part, q.id, 'save', now, text.length, countWords(text));
    }
  }
  return rejected;
}

async function applySignals(c: Ctx, part: PartId, signals: SignalInput[] | undefined, now: Date) {
  if (!signals?.length) return;
  const qIds = new Set(c.variant.questions.filter((q) => q.part === part).map((q) => q.id));
  for (const s of signals.slice(0, 100)) {
    const age = Math.min(Math.max(Number((s as { ageMs?: number }).ageMs ?? 0) || 0, 0), 10 * 60_000);
    let at = new Date(now.getTime() - age);
    if (c.inv.startedAt && at < c.inv.startedAt) at = c.inv.startedAt;
    if (s.kind === 'paste') {
      if (!qIds.has(s.questionId)) continue;
      await addEvent(c, part, s.questionId, 'paste', at, Math.min(Number(s.chars) || 0, 1_000_000));
    } else if (s.kind === 'blur_start') {
      await addEvent(c, part, null, 'blur_start', at, 0);
    } else if (s.kind === 'blur_end') {
      await addEvent(c, part, null, 'blur_end', at, Math.min(Number(s.ms) || 0, 24 * 3600_000));
    }
  }
}

export async function saveAnswers(
  store: Store,
  token: string,
  part: PartId,
  answers: AnswerInput[],
  signals: SignalInput[] | undefined,
  now = new Date(),
): Promise<SaveResult> {
  return withWritableAttempt(store, token, now, async (c, current) => {
    assertActivePart(part, current);
    const rejected = await applyAnswers(c, part, answers, now);
    await applySignals(c, part, signals, now);
    return { serverNow: now.toISOString(), deadlineAt: c.inv.deadlineAt!.toISOString(), rejected };
  });
}

export async function recordSignals(store: Store, token: string, signals: SignalInput[], now = new Date()): Promise<void> {
  await withWritableAttempt(store, token, now, async (c, current) => {
    await applySignals(c, current, signals, now);
  });
}

/** Envía y bloquea la parte activa (con las respuestas finales). Si era la última, termina la prueba. */
export async function submitPart(
  store: Store,
  token: string,
  part: PartId,
  answers: AnswerInput[],
  signals: SignalInput[] | undefined,
  now = new Date(),
): Promise<AttemptView> {
  await withWritableAttempt(store, token, now, async (c, current) => {
    assertActivePart(part, current);
    const rejected = await applyAnswers(c, part, answers, now);
    if (rejected.length) {
      // La transacción se descarta completa: nada de lo anterior queda guardado.
      throw new AppError('over_limit', 422, 'Hay respuestas por encima del límite de palabras', { rejected });
    }
    await applySignals(c, part, signals, now);
    c.patch.submitted = { [part]: now.toISOString() };
    if (part === PART_ORDER[PART_ORDER.length - 1]) {
      c.patch.finishedAt = now.toISOString();
      c.patch.closedAt = now.toISOString();
      c.patch.closedReason = 'submitted';
    }
  });
  return getAttemptView(store, token, now);
}
