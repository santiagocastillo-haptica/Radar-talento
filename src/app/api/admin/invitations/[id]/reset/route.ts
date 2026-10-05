import { adminRoute } from '@/server/http';
import { resetClock } from '@/server/invitations';
import { resetBody } from '@/server/schemas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return adminRoute(
    req,
    async (db, admin) => {
      const body = resetBody.parse(await req.json());
      return resetClock(db, id, admin, body.reason);
    },
    { mutation: true },
  );
}
