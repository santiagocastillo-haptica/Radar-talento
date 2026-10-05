import { candidateRoute } from '@/server/http';
import { getAttemptView } from '@/server/attempt';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return candidateRoute(req, (db, token) => getAttemptView(db, token));
}
