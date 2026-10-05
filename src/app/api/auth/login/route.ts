import { NextResponse } from 'next/server';
import { AppError } from '@/server/attempt';
import { authenticate } from '@/server/adminUsers';
import { startSession } from '@/server/adminAuth';
import { clientIp, safeHint } from '@/server/http';
import { getStore } from '@/server/store';
import { isSameOrigin } from '@/server/origin';

export const dynamic = 'force-dynamic';

/** Inicio de sesión del panel (formulario HTML). Mensaje genérico ante credenciales inválidas. */
export async function POST(req: Request) {
  const base = new URL(req.url).origin;
  const back = (error: string, hint?: string) => NextResponse.redirect(`${base}/admin/login?error=${error}${hint ? `&hint=${hint}` : ''}`, 303);
  if (!isSameOrigin(req.headers)) return back('bad_origin');
  try {
    const form = await req.formData();
    const user = await authenticate(await getStore(), String(form.get('email') ?? ''), String(form.get('password') ?? ''), clientIp(req));
    await startSession(user.email, user.tokenVersion);
    return NextResponse.redirect(`${base}${user.mustChange ? '/admin/cuenta' : '/admin'}`, 303);
  } catch (e) {
    if (e instanceof AppError) return back(e.code === 'rate_limited' ? 'rate_limited' : 'bad_credentials');
    console.error('[auth] error inesperado:', (e as Error)?.message);
    return back('server', safeHint(e));
  }
}
