import { z } from 'zod';
import { adminRoute } from '@/server/http';
import { setActive } from '@/server/adminUsers';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return adminRoute(
    req,
    async (db, admin) => {
      const b = z.object({ email: z.string().email(), active: z.boolean() }).parse(await req.json());
      await setActive(db, b.email, b.active, admin);
      return { ok: true };
    },
    { mutation: true },
  );
}
