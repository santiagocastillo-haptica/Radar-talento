import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './attempt';
import { getStore, type Store } from './store';
import { isRateLimited, recordRateEvent } from './ratelimit';
import { currentAdminSession } from './adminAuth';

export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  return (xf ? xf.split(',')[0].trim() : req.headers.get('x-real-ip')) || 'unknown';
}

/** Categoría de un error de infraestructura, sin ningún dato sensible: ayuda a diagnosticar sin abrir los logs. */
export function safeHint(e: unknown): string {
  const msg = String((e as Error)?.message ?? '');
  const code = (e as { code?: unknown })?.code;
  if (msg.startsWith('Falta FIREBASE_SERVICE_ACCOUNT')) return 'service_account_missing';
  if (msg.startsWith('FIREBASE_SERVICE_ACCOUNT no es')) return 'service_account_invalid';
  if (/Falta la variable de entorno/.test(msg)) return 'env_var_missing';
  if (code === 5 || /NOT_FOUND/.test(msg)) return 'firestore_database_not_found';
  if (code === 7 || /PERMISSION_DENIED/.test(msg)) return 'firestore_permission_denied';
  if (code === 16 || /UNAUTHENTICATED|invalid_grant|private key/i.test(msg)) return 'firestore_bad_credentials';
  if (code === 9 || /FAILED_PRECONDITION|requires an index/i.test(msg)) return 'firestore_needs_index';
  return 'unknown';
}

function errorResponse(e: unknown): NextResponse {
  if (e instanceof AppError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, ...e.extra } }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json({ error: { code: 'bad_request', message: 'Solicitud inválida' } }, { status: 400 });
  }
  // Nunca se registra el token ni el cuerpo de la petición.
  console.error('[api] error inesperado:', (e as Error)?.message);
  return NextResponse.json(
    { error: { code: 'server_error', message: 'Error interno', hint: safeHint(e), build: (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7) } },
    { status: 500 },
  );
}

/** Rutas del candidato: el token viaja en el encabezado X-Attempt-Token (no en la URL, para que no quede en logs). */
export async function candidateRoute(req: Request, fn: (db: Store, token: string) => Promise<unknown>): Promise<NextResponse> {
  try {
    const db = await getStore();
    const ip = clientIp(req);
    const rlKey = `tok:${ip}`;
    if (await isRateLimited(db, rlKey, 20, 600)) {
      return NextResponse.json({ error: { code: 'rate_limited', message: 'Demasiados intentos. Espera unos minutos.' } }, { status: 429 });
    }
    const token = req.headers.get('x-attempt-token') ?? '';
    try {
      return NextResponse.json(await fn(db, token));
    } catch (e) {
      if (e instanceof AppError && e.code === 'invalid_token') await recordRateEvent(db, rlKey);
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}

/** Rutas del panel: exigen sesión de administrador y mismo origen en las mutaciones. */
export async function adminRoute(
  req: Request,
  fn: (db: Store, admin: string) => Promise<unknown | Response>,
  opts: { mutation?: boolean; allowMustChange?: boolean } = {},
): Promise<Response> {
  try {
    const session = await currentAdminSession();
    if (!session) return NextResponse.json({ error: { code: 'unauthorized', message: 'Sesión requerida' } }, { status: 401 });
    if (session.mustChange && !opts.allowMustChange) {
      return NextResponse.json({ error: { code: 'must_change_password', message: 'Debes cambiar tu contraseña antes de continuar' } }, { status: 403 });
    }
    const admin = session.email;
    if (opts.mutation) {
      const origin = req.headers.get('origin');
      const host = req.headers.get('host');
      if (origin && host && new URL(origin).host !== host) {
        return NextResponse.json({ error: { code: 'bad_origin', message: 'Origen no permitido' } }, { status: 403 });
      }
      if (!(req.headers.get('content-type') ?? '').includes('application/json')) {
        return NextResponse.json({ error: { code: 'bad_request', message: 'Se esperaba JSON' } }, { status: 415 });
      }
    }
    const out = await fn(await getStore(), admin);
    return out instanceof Response ? out : NextResponse.json(out);
  } catch (e) {
    return errorResponse(e);
  }
}
