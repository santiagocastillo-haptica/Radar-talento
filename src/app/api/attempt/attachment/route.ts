import { candidateRoute } from '@/server/http';
import { getOwnAttachment, setAttachment } from '@/server/attempt';
import { attachmentDeleteBody, attachmentPutBody } from '@/server/schemas';

export const dynamic = 'force-dynamic';

/** Adjunta o reemplaza la imagen opcional de una pregunta (JPG/PNG/WebP ya reducida en el navegador). */
export async function PUT(req: Request) {
  return candidateRoute(req, async (db, token) => {
    const b = attachmentPutBody.parse(await req.json());
    return setAttachment(db, token, b.part, b.questionId, { base64: b.data });
  });
}

export async function DELETE(req: Request) {
  return candidateRoute(req, async (db, token) => {
    const b = attachmentDeleteBody.parse(await req.json());
    return setAttachment(db, token, b.part, b.questionId, null);
  });
}

/** La persona vuelve a ver su propia imagen (p. ej. tras recargar la página). */
export async function GET(req: Request) {
  return candidateRoute(req, async (db, token) => {
    const q = new URL(req.url).searchParams.get('q') ?? '';
    const { mime, bytes } = await getOwnAttachment(db, token, q);
    return new Response(new Uint8Array(bytes), {
      headers: { 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' },
    });
  });
}
