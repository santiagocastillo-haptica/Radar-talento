import { z } from 'zod';
import { adminRoute } from '@/server/http';
import { deleteInvitation } from '@/server/invitations';

export const dynamic = 'force-dynamic';

const body = z.object({ reason: z.string().trim().min(5).max(1000), confirmName: z.string().min(1).max(200) });

/** Elimina definitivamente la invitación y todos sus datos (respuestas, señales, evaluación). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return adminRoute(
    req,
    async (db, admin) => {
      const b = body.parse(await req.json());
      return deleteInvitation(db, id, admin, b.reason, b.confirmName);
    },
    { mutation: true },
  );
}
