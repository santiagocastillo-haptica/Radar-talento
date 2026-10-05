import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './attempt';
import { getStore, type Store } from './store';
import { isRateLimited, recordRateEvent } from './ratelimit';
import { currentAdmin } from './adminAuth';

export function clientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  return (xf ? xf.split(',')[0].trim() : req.headers.get('x-real-ip')) || 'unknown';
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
  return NextResponse.json({ error: { code: 'server_error', message: 'Error interno' } }, { status: 500 });
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
  opts: { mutation?: boolean } = {},
): Promise<Response> {
  try {
    const admin = await currentAdmin();
    if (!admin) return NextResponse.json({ error: { code: 'unauthorized', message: 'Sesión requerida' } }, { status: 401 });
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
