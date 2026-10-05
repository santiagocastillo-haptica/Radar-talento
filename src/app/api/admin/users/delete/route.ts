import { z } from 'zod';
import { adminRoute } from '@/server/http';
import { deleteAdminUser } from '@/server/adminUsers';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return adminRoute(
    req,
    async (db, admin) => {
      const { email } = z.object({ email: z.string().email() }).parse(await req.json());
      await deleteAdminUser(db, email, admin);
      return { ok: true };
    },
    { mutation: true },
  );
}
