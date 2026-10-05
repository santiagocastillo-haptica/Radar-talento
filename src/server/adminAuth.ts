import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { config, requireSecret } from './config';
import { getStore } from './store';
import { getAdminUser } from './adminUsers';

/** Sesión del panel: cookie firmada (HS256) con correo y versión; se revalida contra el usuario en cada petición. */

const SESSION_COOKIE = 'hx_admin';
const SESSION_HOURS = 8;
const key = () => new TextEncoder().encode(requireSecret('SESSION_SECRET'));

const cookieOpts = (maxAgeSec: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config().isProd,
  path: '/',
  maxAge: maxAgeSec,
});

export async function startSession(email: string, tokenVersion: number) {
  const jwt = await new SignJWT({ email: email.toLowerCase(), v: tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
  (await cookies()).set(SESSION_COOKIE, jwt, cookieOpts(SESSION_HOURS * 3600));
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export interface AdminSession {
  email: string;
  name: string;
  mustChange: boolean;
}

/** Administrador con sesión válida y cuenta activa, o null. Cambiar la contraseña o desactivar la cuenta cierra sus sesiones. */
export async function currentAdminSession(): Promise<AdminSession | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, key(), { algorithms: ['HS256'] });
    const user = await getAdminUser(await getStore(), String(payload.email ?? ''));
    if (!user || !user.active || user.tokenVersion !== payload.v) return null;
    return { email: user.email, name: user.name, mustChange: user.mustChange };
  } catch {
    return null;
  }
}

export async function currentAdmin(): Promise<string | null> {
  return (await currentAdminSession())?.email ?? null;
}

/** Para páginas del panel: redirige al login (o al cambio de contraseña obligatorio). */
export async function requireAdminPage(opts: { allowMustChange?: boolean } = {}): Promise<string> {
  const s = await currentAdminSession();
  if (!s) redirect('/admin/login');
  if (s.mustChange && !opts.allowMustChange) redirect('/admin/cuenta');
  return s.email;
}
