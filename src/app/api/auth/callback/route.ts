import { NextResponse } from 'next/server';
import { completeMicrosoftLogin, startSession } from '@/server/adminAuth';
import { config } from '@/server/config';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = config().appUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return NextResponse.redirect(`${base}/admin/login?error=oauth`);
  try {
    const email = await completeMicrosoftLogin(code, state);
    await startSession(email);
    return NextResponse.redirect(`${base}/admin`);
  } catch (e) {
    console.error('[auth] fallo de inicio de sesión:', (e as Error).message);
    return NextResponse.redirect(`${base}/admin/login?error=denied`);
  }
}
