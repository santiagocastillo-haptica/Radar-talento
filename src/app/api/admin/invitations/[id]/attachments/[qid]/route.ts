import { NextResponse } from 'next/server';
import { adminRoute } from '@/server/http';
import { getAttachmentForAdmin } from '@/server/review';

export const dynamic = 'force-dynamic';

/** Imagen adjunta de una pregunta, solo para el equipo con sesión. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; qid: string }> }) {
  const { id, qid } = await ctx.params;
  return adminRoute(req, async (db) => {
    const img = await getAttachmentForAdmin(db, id, qid);
    if (!img) return NextResponse.json({ error: { code: 'not_found', message: 'Sin imagen' } }, { status: 404 });
    return new Response(new Uint8Array(img.bytes), {
      headers: {
        'Content-Type': img.mime,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  });
}
