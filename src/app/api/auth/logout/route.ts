import { NextResponse } from 'next/server';
import { endSession } from '@/server/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  await endSession();
  return NextResponse.redirect(`${new URL(req.url).origin}/admin/login`, 303);
}
