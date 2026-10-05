import { candidateRoute } from '@/server/http';
import { submitPart } from '@/server/attempt';
import { saveBody } from '@/server/schemas';

export const dynamic = 'force-dynamic';

/** Envía y bloquea la parte activa; responde con el estado siguiente (parte siguiente o fin). */
export async function POST(req: Request) {
  return candidateRoute(req, async (db, token) => {
    const body = saveBody.parse(await req.json());
    return submitPart(db, token, body.part, body.answers, body.signals);
  });
}
