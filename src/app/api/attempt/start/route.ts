import { candidateRoute } from '@/server/http';
import { startAttempt } from '@/server/attempt';
import { startBody } from '@/server/schemas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return candidateRoute(req, async (db, token) => {
    const body = startBody.parse(await req.json());
    return startAttempt(db, token, body.accepted);
  });
}
