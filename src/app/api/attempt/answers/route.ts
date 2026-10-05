import { candidateRoute } from '@/server/http';
import { saveAnswers } from '@/server/attempt';
import { saveBody } from '@/server/schemas';

export const dynamic = 'force-dynamic';

/** Autoguardado. */
export async function PUT(req: Request) {
  return candidateRoute(req, async (db, token) => {
    const body = saveBody.parse(await req.json());
    return saveAnswers(db, token, body.part, body.answers, body.signals);
  });
}
