import { adminRoute } from '@/server/http';
import { saveEvaluation } from '@/server/review';
import { evaluationBody } from '@/server/schemas';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return adminRoute(
    req,
    async (db, admin) => {
      const body = evaluationBody.parse(await req.json());
      await saveEvaluation(db, id, body.key, body.status, admin);
      return { ok: true };
    },
    { mutation: true },
  );
}
