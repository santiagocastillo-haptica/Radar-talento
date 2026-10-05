import { z } from 'zod';
import { adminRoute } from '@/server/http';
import { resetPassword } from '@/server/adminUsers';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return adminRoute(
    req,
    async (db, admin) => {
      const { email } = z.object({ email: z.string().email() }).parse(await req.json());
      return { temporaryPassword: await resetPassword(db, email, admin) };
    },
    { mutation: true },
  );
}
