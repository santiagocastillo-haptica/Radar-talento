import { AppError, replaceRole } from './attempt';
import { audit } from './invitations';
import { computeStatus, remainingMs, type Status } from './status';
import { invPath, loadVariant, toInv, type VariantKeysDoc } from './model';
import type { Store } from './store';
import { summarizeSignals, type SignalRow, type SignalSummary } from '@/lib/signals';
import { countWords } from '@/lib/words';
import { PART_ORDER, ROLE_LABEL, type Block, type PartId, type Role } from '@/content/types';
import { EVAL_STATUSES, PART3_INDICATORS, SKILLS, type EvalStatus } from '@/content/rubric';

/** Todo lo que lee el panel del evaluador. AQUÍ (y solo aquí, junto con el seed) se toca variantKeys. */

// ───────────────────────── Lista ─────────────────────────

export interface ListRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  variantName: string;
  status: Status;
  createdAt: string;
  expiresAt: string;
  openedAt: string | null;
  startedAt: string | null;
  deadlineAt: string | null;
  remainingMs: number | null;
  currentPart: PartId | null;
  clockResets: number;
}

export async function listInvitations(store: Store, now = new Date()): Promise<ListRow[]> {
  const docs = await store.query('invitations', { orderBy: ['createdAt', 'desc'] });
  const variants = await store.query('variants');
  const names = new Map(variants.map((v) => [v.id, v.data.name as string]));
  return docs.map(({ id, data }) => {
    const r = toInv(id, data);
    const status = computeStatus(r, now);
    return {
      id,
      name: r.name,
      email: r.email,
      role: r.role,
      roleLabel: ROLE_LABEL[r.role],
      variantName: names.get(r.variant) ?? r.variant,
      status,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      openedAt: r.openedAt?.toISOString() ?? null,
      startedAt: r.startedAt?.toISOString() ?? null,
      deadlineAt: r.deadlineAt?.toISOString() ?? null,
      remainingMs: status === 'en_curso' ? remainingMs(r, now) : null,
      currentPart: status === 'en_curso' ? (PART_ORDER.find((p) => !r.submitted[p]) ?? null) : null,
      clockResets: r.clockResets,
    };
  });
}

// ───────────────────────── Detalle de un candidato ─────────────────────────

export interface McReview {
  selectedOptionId: string | null;
  selectedText: string | null;
  correctOptionId: string;
  correctText: string;
  correct: boolean | null; // null = sin responder
  skills: string[];
  options: { id: string; text: string; isCorrect: boolean; selected: boolean }[];
}

export interface QuestionReview {
  id: string;
  number: number;
  kind: 'open' | 'mc';
  label: string | null;
  prompt: string;
  wordLimit: number | null;
  text: string | null;
  words: number;
  /** Imagen adjunta opcional (los bytes se piden aparte al panel). */
  image?: { mime: string; size: number };
  mc?: McReview;
}

export interface PartReview {
  id: PartId;
  title: string;
  submitted: boolean;
  submittedAt: string | null;
  startedAt: string | null;
  durationSec: number | null;
  suggestedMinutes: number;
  groupWordLimit: number | null;
  questions: QuestionReview[];
}

export interface CandidateDetail {
  invitation: {
    id: string;
    name: string;
    email: string;
    role: Role;
    roleLabel: string;
    status: Status;
    createdAt: string;
    expiresAt: string;
    openedAt: string | null;
    startedAt: string | null;
    deadlineAt: string | null;
    finishedAt: string | null;
    closedReason: string | null;
    clockResets: number;
    remainingMs: number | null;
  };
  variant: { slug: string; name: string; caseTitle: string; caseContext: Block[]; twist: Block[] };
  parts: PartReview[];
  part2BySkill: { skill: string; correct: number; total: number }[];
  signals: SignalSummary;
  evaluations: Record<string, EvalStatus>;
  notes: Record<string, string>;
  audit: { at: string; actor: string; action: string; reason: string | null; details: Record<string, unknown> }[];
}

export async function getCandidateDetail(store: Store, id: string, now = new Date()): Promise<CandidateDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const doc = await store.get(invPath(id));
  if (!doc) return null;
  const inv = toInv(id, doc);
  const status = computeStatus(inv, now);

  const variant = await loadVariant(store, inv.variant);
  const keysDoc = ((await store.get(`variantKeys/${inv.variant}`)) as VariantKeysDoc | null) ?? { keys: {} };
  const answers = await store.query(`${invPath(id)}/answers`);
  const events = await store.query(`${invPath(id)}/signals`);
  const auditRows = await store.query('auditLog', { where: [['invitationId', '==', id]] });

  const ansByQ = new Map(answers.map((a) => [a.id, a.data]));
  const roleLabel = ROLE_LABEL[inv.role];

  const skillAgg = new Map<string, { correct: number; total: number }>();
  const parts: PartReview[] = [];
  for (const vp of variant.parts) {
    const submittedAt = inv.submitted[vp.part] ?? null;
    const idx = PART_ORDER.indexOf(vp.part);
    const prevSub = idx > 0 ? inv.submitted[PART_ORDER[idx - 1]] : undefined;
    let startedAt: Date | null = null;
    if (inv.startedAt && (idx === 0 || prevSub)) {
      startedAt = new Date(Math.max(inv.startedAt.getTime(), prevSub?.getTime() ?? 0));
    }
    const endAt: Date | null = submittedAt ?? (startedAt ? (inv.closedAt ?? (status === 'en_curso' ? now : null)) : null);
    // Una parte enviada antes de un reinicio de reloj no tiene duración confiable.
    const durationSec =
      startedAt && endAt && endAt >= startedAt && !(submittedAt && inv.startedAt && submittedAt < inv.startedAt)
        ? Math.round((endAt.getTime() - startedAt.getTime()) / 1000)
        : null;

    const questions: QuestionReview[] = variant.questions
      .filter((q) => q.part === vp.part)
      .map((q) => {
        const a = ansByQ.get(q.id);
        const base: QuestionReview = {
          id: q.id,
          number: q.number,
          kind: q.kind,
          label: q.label,
          prompt: replaceRole(q.prompt, inv.role),
          wordLimit: q.wordLimit,
          text: (a?.text as string | undefined) ?? null,
          words: countWords(a?.text),
        };
        const meta = inv.attachments[q.id];
        if (meta) base.image = { mime: meta.mime, size: meta.size };
        if (q.kind === 'mc') {
          const key = keysDoc.keys[q.id];
          const opts = q.options!;
          const order = inv.optionOrders[q.id];
          const ordered = order ? order.map((oid) => opts.find((o) => o.id === oid)!).filter(Boolean) : opts;
          const selected = (a?.optionId as string | undefined) ?? null;
          const skills = key.skill.split(',');
          const correct = selected ? selected === key.correctOptionId : null;
          for (const s of skills) {
            const agg = skillAgg.get(s) ?? { correct: 0, total: 0 };
            agg.total += 1;
            if (correct) agg.correct += 1;
            skillAgg.set(s, agg);
          }
          base.mc = {
            selectedOptionId: selected,
            selectedText: ordered.find((o) => o.id === selected)?.text ?? null,
            correctOptionId: key.correctOptionId,
            correctText: opts.find((o) => o.id === key.correctOptionId)?.text ?? '',
            correct,
            skills,
            options: ordered.map((o) => ({ id: o.id, text: o.text, isCorrect: o.id === key.correctOptionId, selected: o.id === selected })),
          };
        }
        return base;
      });

    parts.push({
      id: vp.part,
      title: vp.title,
      submitted: !!submittedAt,
      submittedAt: submittedAt?.toISOString() ?? null,
      startedAt: startedAt?.toISOString() ?? null,
      durationSec,
      suggestedMinutes: vp.suggestedMinutes,
      groupWordLimit: vp.groupWordLimit,
      questions,
    });
  }

  const signalRows: SignalRow[] = events
    .map((e) => ({ part: e.data.part, questionId: e.data.questionId ?? null, kind: e.data.kind, at: new Date(e.data.at), a: e.data.a ?? 0, b: e.data.b ?? 0 }))
    .sort((x, y) => x.at.getTime() - y.at.getTime());

  return {
    invitation: {
      id: inv.id,
      name: inv.name,
      email: inv.email,
      role: inv.role,
      roleLabel,
      status,
      createdAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt.toISOString(),
      openedAt: inv.openedAt?.toISOString() ?? null,
      startedAt: inv.startedAt?.toISOString() ?? null,
      deadlineAt: inv.deadlineAt?.toISOString() ?? null,
      finishedAt: inv.finishedAt?.toISOString() ?? null,
      closedReason: inv.closedReason,
      clockResets: inv.clockResets,
      remainingMs: status === 'en_curso' ? remainingMs(inv, now) : null,
    },
    variant: { slug: variant.slug, name: variant.name, caseTitle: variant.caseTitle, caseContext: variant.caseContext, twist: variant.twist },
    parts,
    part2BySkill: [...skillAgg.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([skill, v]) => ({ skill, ...v })),
    signals: summarizeSignals(signalRows),
    evaluations: Object.fromEntries(Object.entries(inv.evaluations).filter(([, v]) => v).map(([k, v]) => [k, v!.status as EvalStatus])),
    notes: Object.fromEntries(Object.entries(inv.notes).filter(([, v]) => v).map(([k, v]) => [k, v!.note])),
    audit: auditRows
      .map((r) => ({ at: r.data.at as string, actor: r.data.actor as string, action: r.data.action as string, reason: (r.data.reason as string | null) ?? null, details: (r.data.details ?? {}) as Record<string, unknown> }))
      .sort((a, b) => a.at.localeCompare(b.at)),
  };
}

// ───────────────────────── Evaluación y notas ─────────────────────────

const VALID_EVAL_KEYS = new Set([...SKILLS.filter((s) => s.evidenced).map((s) => s.code), ...PART3_INDICATORS.map((i) => i.key)]);

async function assertExists(store: Store, id: string) {
  if (!(await store.get(invPath(id)))) throw new AppError('not_found', 404, 'Invitación no encontrada');
}

export async function saveEvaluation(store: Store, invitationId: string, key: string, status: EvalStatus | null, actor: string, now = new Date()) {
  if (!VALID_EVAL_KEYS.has(key)) throw new AppError('bad_key', 422, 'Habilidad o indicador desconocido (la habilidad 07 no se evidencia en esta prueba)');
  if (status !== null && !EVAL_STATUSES.includes(status)) throw new AppError('bad_status', 422, 'Estado inválido');
  await assertExists(store, invitationId);
  await store.merge(invPath(invitationId), { evaluations: { [key]: status === null ? null : { status, by: actor, at: now.toISOString() } } });
  await audit(store, { actor, action: 'evaluation_set', invitationId, details: { key, status } }, now);
}

export async function saveNote(store: Store, invitationId: string, part: PartId, note: string, actor: string, now = new Date()) {
  if (!PART_ORDER.includes(part)) throw new AppError('bad_part', 422, 'Parte desconocida');
  if (note.length > 20000) throw new AppError('too_long', 422, 'Nota demasiado larga');
  await assertExists(store, invitationId);
  await store.merge(invPath(invitationId), { notes: { [part]: { note, by: actor, at: now.toISOString() } } });
}

/** Bytes de la imagen adjunta de una pregunta, para mostrarla en el panel. */
export async function getAttachmentForAdmin(store: Store, invitationId: string, questionId: string): Promise<{ mime: string; bytes: Buffer } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(invitationId) || !/^[0-9A-Za-z-]{1,20}$/.test(questionId)) return null;
  const doc = await store.get(`${invPath(invitationId)}/attachments/${questionId}`);
  return doc ? { mime: doc.mime as string, bytes: Buffer.from(doc.data as string, 'base64') } : null;
}
