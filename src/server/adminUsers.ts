import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { AppError } from './attempt';
import { audit } from './invitations';
import { isRateLimited, recordRateEvent } from './ratelimit';
import type { Store } from './store';

/**
 * Usuarios del panel: correo + contraseña propios (sin Google ni Microsoft).
 * Contraseñas con scrypt (sal aleatoria por usuario); jamás se guardan ni se registran en claro.
 */

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, keylen: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

export interface AdminUser {
  email: string;
  name: string;
  active: boolean;
  mustChange: boolean;
  tokenVersion: number;
  createdAt: string;
  createdBy: string;
  lastLoginAt: string | null;
}

const normalizeEmail = (e: string) => e.trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const userPath = (email: string) => `adminUsers/${crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex')}`;

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const dk = await scrypt(pw, salt, PARAMS.keylen, { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p });
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), dk.toString('base64')].join('$');
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [kind, N, r, p, saltB64, hashB64] = stored.split('$');
  if (kind !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const dk = await scrypt(pw, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return dk.length === expected.length && crypto.timingSafeEqual(dk, expected);
}

/**
 * Verifica tolerando espacios o saltos de línea sobrantes en los extremos (típico al copiar una contraseña
 * temporal desde una terminal). Primero se prueba tal cual.
 */
async function verifyLoose(pw: string, stored: string): Promise<boolean> {
  if (await verifyPassword(pw, stored)) return true;
  const trimmed = pw.trim();
  return trimmed.length > 0 && trimmed !== pw ? verifyPassword(trimmed, stored) : false;
}

/** Mínimo razonable sin reglas absurdas: largo, no igual al correo, no repetitiva. */
export function validatePassword(pw: string, email: string): string | null {
  if (typeof pw !== 'string' || pw.length < 12) return 'La contraseña debe tener al menos 12 caracteres.';
  if (pw.length > 128) return 'La contraseña no puede superar 128 caracteres.';
  if (normalizeEmail(email) === pw.trim().toLowerCase() || normalizeEmail(email).split('@')[0] === pw.trim().toLowerCase()) {
    return 'La contraseña no puede ser igual al correo.';
  }
  if (new Set(pw).size < 5) return 'La contraseña es demasiado repetitiva.';
  return null;
}

/** Contraseña temporal aleatoria (≈120 bits). Se muestra una sola vez. */
export function generatePassword(): string {
  return crypto.randomBytes(15).toString('base64url');
}

const toUser = (d: Record<string, any>): AdminUser => ({
  email: d.email,
  name: d.name ?? '',
  active: !!d.active,
  mustChange: !!d.mustChange,
  tokenVersion: d.tokenVersion ?? 0,
  createdAt: d.createdAt,
  createdBy: d.createdBy,
  lastLoginAt: d.lastLoginAt ?? null,
});

export async function getAdminUser(store: Store, email: string): Promise<AdminUser | null> {
  const d = await store.get(userPath(email));
  return d ? toUser(d) : null;
}

export async function listAdminUsers(store: Store): Promise<AdminUser[]> {
  const docs = await store.query('adminUsers');
  return docs.map((d) => toUser(d.data)).sort((a, b) => a.email.localeCompare(b.email));
}

/** Crea un usuario. Si no se pasa contraseña, genera una temporal (devuelta una sola vez) que obliga a cambiarla. */
export async function createAdminUser(
  store: Store,
  input: { email: string; name?: string; password?: string; actor: string },
  now = new Date(),
): Promise<{ user: AdminUser; temporaryPassword?: string }> {
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email)) throw new AppError('bad_email', 422, 'Correo inválido');
  const temporary = input.password ? undefined : generatePassword();
  const password = input.password ?? temporary!;
  const problem = validatePassword(password, email);
  if (problem) throw new AppError('weak_password', 422, problem);
  const doc = {
    email,
    name: (input.name ?? '').trim(),
    passwordHash: await hashPassword(password),
    active: true,
    mustChange: !!temporary,
    tokenVersion: 0,
    createdAt: now.toISOString(),
    createdBy: input.actor,
    lastLoginAt: null,
  };
  try {
    await store.create(userPath(email), doc);
  } catch {
    throw new AppError('user_exists', 409, 'Ya existe un usuario con ese correo');
  }
  await audit(store, { actor: input.actor, action: 'admin_user_created', details: { email } }, now);
  return { user: toUser(doc), temporaryPassword: temporary };
}

async function mutate(store: Store, email: string, fn: (cur: Record<string, any>) => Record<string, unknown>) {
  await store.tx(async (t) => {
    const cur = await t.get(userPath(email));
    if (!cur) throw new AppError('not_found', 404, 'Usuario no encontrado');
    await t.merge(userPath(email), fn(cur));
  });
}

/** Restablece la contraseña (temporal, a cambiar en el primer ingreso) e invalida las sesiones abiertas. */
export async function resetPassword(store: Store, email: string, actor: string, now = new Date()): Promise<string> {
  const temporary = generatePassword();
  const hash = await hashPassword(temporary);
  await mutate(store, email, (cur) => ({ passwordHash: hash, mustChange: true, tokenVersion: (cur.tokenVersion ?? 0) + 1 }));
  await audit(store, { actor, action: 'admin_password_reset', details: { email: normalizeEmail(email) } }, now);
  return temporary;
}

export async function changeOwnPassword(store: Store, email: string, current: string, next: string, now = new Date()): Promise<AdminUser> {
  const doc = await store.get(userPath(email));
  if (!doc || !(await verifyLoose(current, doc.passwordHash))) throw new AppError('bad_credentials', 401, 'La contraseña actual no es correcta');
  const problem = validatePassword(next, email);
  if (problem) throw new AppError('weak_password', 422, problem);
  if (await verifyPassword(next, doc.passwordHash)) throw new AppError('same_password', 422, 'La contraseña nueva debe ser distinta de la actual');
  const hash = await hashPassword(next);
  await mutate(store, email, (cur) => ({ passwordHash: hash, mustChange: false, tokenVersion: (cur.tokenVersion ?? 0) + 1 }));
  await audit(store, { actor: normalizeEmail(email), action: 'admin_password_changed', details: { email: normalizeEmail(email) } }, now);
  return (await getAdminUser(store, email))!;
}

export async function setActive(store: Store, email: string, active: boolean, actor: string, now = new Date()) {
  if (!active) {
    const users = await listAdminUsers(store);
    const target = normalizeEmail(email);
    if (!users.some((u) => u.active && u.email !== target)) {
      throw new AppError('last_admin', 409, 'No puedes desactivar al último administrador activo');
    }
  }
  await mutate(store, email, (cur) => ({ active, tokenVersion: (cur.tokenVersion ?? 0) + 1 }));
  await audit(store, { actor, action: active ? 'admin_user_activated' : 'admin_user_deactivated', details: { email: normalizeEmail(email) } }, now);
}

// ───────────────────────── Inicio de sesión ─────────────────────────

const LOGIN_WINDOW_S = 900; // 15 min
const MAX_FAILS_PER_IP = 10;
const MAX_FAILS_PER_EMAIL = 5;
let dummyHash: Promise<string> | null = null;

/** Valida correo + contraseña. Mismo tiempo de respuesta exista o no el usuario; bloqueo temporal tras fallos. */
export async function authenticate(store: Store, email: string, password: string, ip: string, now = new Date()): Promise<AdminUser> {
  const mail = normalizeEmail(email ?? '');
  const ipKey = `login:ip:${ip}`;
  const mailKey = `login:email:${mail}`;
  if ((await isRateLimited(store, ipKey, MAX_FAILS_PER_IP, LOGIN_WINDOW_S, now)) || (await isRateLimited(store, mailKey, MAX_FAILS_PER_EMAIL, LOGIN_WINDOW_S, now))) {
    throw new AppError('rate_limited', 429, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
  }
  const doc = EMAIL_RE.test(mail) ? await store.get(userPath(mail)) : null;
  dummyHash ??= hashPassword('contraseña-ficticia-para-igualar-tiempos');
  const ok = await verifyLoose(String(password ?? ''), doc?.passwordHash ?? (await dummyHash));
  if (!doc || !doc.active || !ok) {
    // Solo para los registros del servidor (el usuario ve siempre el mismo mensaje): sin contraseña ni correo en claro.
    const who = crypto.createHash('sha256').update(mail).digest('hex').slice(0, 8);
    console.warn(`[auth] login fallido motivo=${!doc ? 'usuario_inexistente' : !doc.active ? 'cuenta_desactivada' : 'contrasena_distinta'} usuario=${who}`);
    await recordRateEvent(store, ipKey, now, LOGIN_WINDOW_S);
    await recordRateEvent(store, mailKey, now, LOGIN_WINDOW_S);
    throw new AppError('bad_credentials', 401, 'Correo o contraseña incorrectos');
  }
  await store.merge(userPath(mail), { lastLoginAt: now.toISOString() });
  return toUser({ ...doc, lastLoginAt: now.toISOString() });
}

/** Diagnóstico para el script local: dice en qué paso falla un inicio de sesión. Nunca se expone por HTTP. */
export async function diagnoseLogin(store: Store, email: string, password: string): Promise<string> {
  const doc = await store.get(userPath(email));
  if (!doc) return `NO EXISTE un usuario con el correo "${normalizeEmail(email)}" en esta base de datos.`;
  if (!doc.active) return 'El usuario existe pero está DESACTIVADO.';
  if (!(await verifyLoose(password, doc.passwordHash))) return 'El usuario existe y está activo, pero la CONTRASEÑA NO COINCIDE con la guardada.';
  return 'OK: correo y contraseña coinciden. Si el sitio los rechaza, el problema está en el despliegue (otra base de datos o versión).';
}
