import { config } from './config';
import { generateToken, hashToken } from './tokens';
import { AppError } from './attempt';
import { computeStatus } from './status';
import { invPath, toInv } from './model';
import { newId, type Store, type Writer } from './store';
import type { Role } from '@/content/types';

export interface NewInvitation {
  id: string;
  token: string;
  link: string;
  expiresAt: string;
}

export function linkFor(token: string): string {
  // El token va en el fragmento (#): el navegador no lo envía al servidor, así no queda en logs de acceso.
  return `${config().appUrl}/i#${token}`;
}

/** Crea la invitación y asigna al azar una variante activa del rol. El token solo se devuelve aquí (se guarda su hash). */
export async function createInvitation(
  store: Store,
  input: { name: string; email: string; role: Role; actor: string },
  now = new Date(),
): Promise<NewInvitation> {
  const variants = await store.query('variants', { where: [['role', '==', input.role], ['active', '==', true]] });
  if (!variants.length) throw new AppError('no_variant', 409, 'No hay variantes activas para ese rol (¿se ejecutó el seed?)');
  const variant = variants[Math.floor(Math.random() * variants.length)];
  const token = generateToken();
  const expires = new Date(now.getTime() + config().inviteValidHours * 3600_000);
  const id = newId();
  await store.set(invPath(id), {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    variant: variant.id,
    tokenHash: hashToken(token),
    createdBy: input.actor,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    openedAt: null,
    termsAcceptedAt: null,
    startedAt: null,
    deadlineAt: null,
    finishedAt: null,
    closedAt: null,
    closedReason: null,
    clockResets: 0,
    submitted: {},
    optionOrders: {},
    signalCount: 0,
    evaluations: {},
    notes: {},
  });
  await audit(store, { actor: input.actor, action: 'invitation_created', invitationId: id, details: { role: input.role, variant: variant.id } }, now);
  return { id, token, link: linkFor(token), expiresAt: expires.toISOString() };
}

/**
 * Un enlace no se puede volver a mostrar (solo se guarda su hash): se emite uno nuevo y el anterior deja de servir.
 *  - Sin iniciar (o vencido): reinicia la vigencia de 24 h.
 *  - En curso (la persona perdió el enlace): el RELOJ NO SE TOCA; solo cambia el enlace. Queda en auditoría.
 *  - Terminada o expirada: no aplica.
 */
export async function regenerateLink(store: Store, invitationId: string, actor: string, now = new Date()): Promise<NewInvitation> {
  const token = generateToken();
  const expires = new Date(now.getTime() + config().inviteValidHours * 3600_000);
  await store.tx(async (t) => {
    const doc = await t.get(invPath(invitationId));
    if (!doc) throw new AppError('not_found', 404, 'Invitación no encontrada');
    const inv = toInv(invitationId, doc);
    const status = computeStatus(inv, now);
    if (status === 'enviada' || status === 'expirada') {
      throw new AppError('not_regenerable', 409, 'La prueba ya terminó: no hay enlace que regenerar');
    }
    if (status === 'en_curso') {
      await t.merge(invPath(invitationId), { tokenHash: hashToken(token) });
      await audit(t, { actor, action: 'link_regenerated', invitationId, details: { inProgress: true, deadlineAt: inv.deadlineAt!.toISOString() } }, now);
      return;
    }
    await t.merge(invPath(invitationId), { tokenHash: hashToken(token), expiresAt: expires.toISOString(), openedAt: null });
    await audit(
      t,
      { actor, action: 'link_regenerated', invitationId, details: { previousExpiresAt: inv.expiresAt.toISOString(), newExpiresAt: expires.toISOString() } },
      now,
    );
  });
  return { id: invitationId, token, link: linkFor(token), expiresAt: expires.toISOString() };
}

/**
 * Reinicio del reloj: solo administrador, con motivo obligatorio y registro inmutable.
 * El candidato recibe una ventana completa nueva desde este momento; se conservan sus respuestas guardadas
 * y las partes ya enviadas siguen bloqueadas. Solo aplica a pruebas en curso o expiradas.
 */
export async function resetClock(store: Store, invitationId: string, actor: string, reason: string, now = new Date()): Promise<{ startedAt: string; deadlineAt: string }> {
  const why = (reason ?? '').trim();
  if (why.length < 5) throw new AppError('reason_required', 422, 'El motivo es obligatorio (mínimo 5 caracteres)');
  const deadline = new Date(now.getTime() + config().durationMinutes * 60_000);
  await store.tx(async (t) => {
    const doc = await t.get(invPath(invitationId));
    if (!doc) throw new AppError('not_found', 404, 'Invitación no encontrada');
    const inv = toInv(invitationId, doc);
    const status = computeStatus(inv, now);
    if (status !== 'en_curso' && status !== 'expirada') {
      throw new AppError('not_resettable', 409, 'Solo se puede reiniciar el reloj de una prueba en curso o expirada');
    }
    await audit(
      t,
      {
        actor,
        action: 'clock_reset',
        invitationId,
        reason: why,
        details: {
          previousStartedAt: inv.startedAt!.toISOString(),
          previousDeadlineAt: inv.deadlineAt!.toISOString(),
          previousStatus: status,
          newStartedAt: now.toISOString(),
          newDeadlineAt: deadline.toISOString(),
        },
      },
      now,
    );
    await t.merge(invPath(invitationId), {
      startedAt: now.toISOString(),
      deadlineAt: deadline.toISOString(),
      closedAt: null,
      closedReason: null,
      clockResets: inv.clockResets + 1,
    });
  });
  return { startedAt: now.toISOString(), deadlineAt: deadline.toISOString() };
}

/** Solo-añadir: se usa `create` (falla si existe) y el almacén rechaza set/merge/delete sobre auditLog. */
export async function audit(
  w: Writer,
  e: { actor: string; action: string; invitationId?: string; reason?: string; details?: Record<string, unknown> },
  now = new Date(),
) {
  await w.create(`auditLog/${newId()}`, {
    at: now.toISOString(),
    actor: e.actor,
    action: e.action,
    invitationId: e.invitationId ?? null,
    reason: e.reason ?? null,
    details: e.details ?? {},
  });
}

/**
 * Elimina DEFINITIVAMENTE una invitación y todo lo asociado (respuestas, señales, evaluación y notas).
 * Exige motivo y que se escriba el nombre de la persona. En la auditoría (inmutable) queda quién, cuándo y por qué,
 * pero NO el nombre ni el correo de la persona eliminada.
 */
export async function deleteInvitation(
  store: Store,
  invitationId: string,
  actor: string,
  reason: string,
  confirmName: string,
  now = new Date(),
): Promise<{ deletedAnswers: number; deletedSignals: number }> {
  const why = (reason ?? '').trim();
  if (why.length < 5) throw new AppError('reason_required', 422, 'El motivo es obligatorio (mínimo 5 caracteres)');
  const doc = await store.get(invPath(invitationId));
  if (!doc) throw new AppError('not_found', 404, 'Invitación no encontrada');
  const inv = toInv(invitationId, doc);
  if ((confirmName ?? '').trim().toLowerCase() !== inv.name.trim().toLowerCase()) {
    throw new AppError('confirm_mismatch', 422, 'El nombre escrito no coincide con el de la persona');
  }
  const answers = await store.query(`${invPath(invitationId)}/answers`);
  const signals = await store.query(`${invPath(invitationId)}/signals`);
  const attachments = await store.query(`${invPath(invitationId)}/attachments`);
  await audit(
    store,
    {
      actor,
      action: 'invitation_deleted',
      invitationId,
      reason: why,
      details: { role: inv.role, status: computeStatus(inv, now), hadStarted: !!inv.startedAt, answers: answers.length, signals: signals.length, images: attachments.length },
    },
    now,
  );
  // Primero los hijos y al final el documento principal: si algo se interrumpe, se puede repetir la eliminación.
  const paths = [...answers.map((a) => `${invPath(invitationId)}/answers/${a.id}`), ...signals.map((s) => `${invPath(invitationId)}/signals/${s.id}`), ...attachments.map((x) => `${invPath(invitationId)}/attachments/${x.id}`)];
  for (let i = 0; i < paths.length; i += 25) await Promise.all(paths.slice(i, i + 25).map((p) => store.delete(p)));
  await store.delete(invPath(invitationId));
  return { deletedAnswers: answers.length, deletedSignals: signals.length };
}
