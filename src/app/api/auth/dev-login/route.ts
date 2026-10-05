import { NextResponse } from 'next/server';
import { adminEmailAllowed, devLoginEnabled, startSession } from '@/server/adminAuth';
import { config } from '@/server/config';

export const dynamic = 'force-dynamic';

/** SOLO desarrollo local (ADMIN_DEV_LOGIN=true y NODE_ENV != production). */
export async function POST(req: Request) {
  if (!devLoginEnabled()) return NextResponse.json({ error: { code: 'disabled', message: 'No disponible' } }, { status: 404 });
  const form = await req.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const c = config();
  const base = new URL(req.url).origin;
  if (!adminEmailAllowed(email, c.adminDomain, c.adminEmails)) {
    return NextResponse.redirect(`${base}/admin/login?error=denied`, 303);
  }
  await startSession(email);
  return NextResponse.redirect(`${base}/admin`, 303);
}
