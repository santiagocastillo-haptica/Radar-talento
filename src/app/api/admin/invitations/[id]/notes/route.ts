import { adminRoute } from '@/server/http';
import { saveNote } from '@/server/review';
import { noteBody } from '@/server/schemas';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return adminRoute(
    req,
    async (db, admin) => {
      const body = noteBody.parse(await req.json());
      await saveNote(db, id, body.part, body.note, admin);
      return { ok: true };
    },
    { mutation: true },
  );
}
