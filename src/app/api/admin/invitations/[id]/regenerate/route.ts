import { adminRoute } from '@/server/http';
import { regenerateLink } from '@/server/invitations';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return adminRoute(req, (db, admin) => regenerateLink(db, id, admin), { mutation: true });
}
