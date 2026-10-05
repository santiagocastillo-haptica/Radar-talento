import { adminRoute } from '@/server/http';
import { createInvitation } from '@/server/invitations';
import { listInvitations } from '@/server/review';
import { inviteBody } from '@/server/schemas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return adminRoute(req, (db) => listInvitations(db));
}

/** Devuelve el enlace UNA sola vez: en la base solo queda el hash del token. */
export async function POST(req: Request) {
  return adminRoute(
    req,
    async (db, admin) => {
      const body = inviteBody.parse(await req.json());
      return createInvitation(db, { ...body, actor: admin });
    },
    { mutation: true },
  );
}
