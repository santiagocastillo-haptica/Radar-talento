import { NextResponse } from 'next/server';
import { buildMicrosoftAuthUrl, microsoftConfigured } from '@/server/adminAuth';
import { config } from '@/server/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!microsoftConfigured()) {
    return NextResponse.redirect(`${config().appUrl}/admin/login?error=ms_not_configured`);
  }
  return NextResponse.redirect(await buildMicrosoftAuthUrl());
}
