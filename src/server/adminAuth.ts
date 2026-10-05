import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import crypto from 'node:crypto';
import { config, requireSecret } from './config';
import { adminEmailAllowed } from './adminPolicy';

export { adminEmailAllowed };

const SESSION_COOKIE = 'hx_admin';
const OAUTH_COOKIE = 'hx_oauth';
const SESSION_HOURS = 8;

const key = () => new TextEncoder().encode(requireSecret('SESSION_SECRET'));

export function microsoftConfigured(): boolean {
  return !!(process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET);
}

export function devLoginEnabled(): boolean {
  return process.env.ADMIN_DEV_LOGIN === 'true' && !config().isProd;
}

const cookieOpts = (maxAgeSec: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config().isProd,
  path: '/',
  maxAge: maxAgeSec,
});

export async function startSession(email: string) {
  const jwt = await new SignJWT({ email: email.toLowerCase() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
  (await cookies()).set(SESSION_COOKIE, jwt, cookieOpts(SESSION_HOURS * 3600));
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Correo del administrador con sesión válida, o null. Se revalida contra la política en cada petición. */
export async function currentAdmin(): Promise<string | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, key(), { algorithms: ['HS256'] });
    const email = String(payload.email ?? '');
    const c = config();
    return adminEmailAllowed(email, c.adminDomain, c.adminEmails) ? email : null;
  } catch {
    return null;
  }
}

/** Para páginas del panel: redirige al login si no hay sesión. */
export async function requireAdminPage(): Promise<string> {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}

// ───────────────────────── Microsoft Entra ID (OIDC, código + PKCE) ─────────────────────────

const authority = () => `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}`;
export const redirectUri = () => `${config().appUrl}/api/auth/callback`;

export async function buildMicrosoftAuthUrl(): Promise<string> {
  const state = crypto.randomBytes(16).toString('base64url');
  const nonce = crypto.randomBytes(16).toString('base64url');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const tmp = await new SignJWT({ state, nonce, verifier }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('10m').sign(key());
  (await cookies()).set(OAUTH_COOKIE, tmp, cookieOpts(600));
  const u = new URL(`${authority()}/oauth2/v2.0/authorize`);
  u.search = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: redirectUri(),
    response_mode: 'query',
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return u.toString();
}

/** Intercambia el código, valida el id_token (firma, emisor, audiencia, tenant, nonce) y devuelve el correo permitido. */
export async function completeMicrosoftLogin(code: string, state: string): Promise<string> {
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete(OAUTH_COOKIE);
  if (!raw) throw new Error('Sesión de inicio expirada');
  const { payload: tmp } = await jwtVerify(raw, key(), { algorithms: ['HS256'] });
  if (tmp.state !== state) throw new Error('Estado OAuth inválido');

  const res = await fetch(`${authority()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID!,
      client_secret: process.env.MS_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: String(tmp.verifier),
    }),
  });
  if (!res.ok) throw new Error('No se pudo completar el inicio de sesión con Microsoft');
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error('Microsoft no devolvió id_token');

  const jwks = createRemoteJWKSet(new URL(`${authority()}/discovery/v2.0/keys`));
  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    audience: process.env.MS_CLIENT_ID,
    issuer: `${authority()}/v2.0`,
  });
  if (payload.nonce !== tmp.nonce) throw new Error('Nonce inválido');
  if (payload.tid !== process.env.MS_TENANT_ID) throw new Error('Tenant no permitido');

  const email = String(payload.email ?? payload.preferred_username ?? '').toLowerCase();
  const c = config();
  if (!adminEmailAllowed(email, c.adminDomain, c.adminEmails)) throw new Error('Cuenta no autorizada para el panel');
  return email;
}
