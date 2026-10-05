import { candidateRoute } from '@/server/http';
import { recordSignals } from '@/server/attempt';
import { signalsBody } from '@/server/schemas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return candidateRoute(req, async (db, token) => {
    const body = signalsBody.parse(await req.json());
    await recordSignals(db, token, body.signals);
    return { ok: true };
  });
}
