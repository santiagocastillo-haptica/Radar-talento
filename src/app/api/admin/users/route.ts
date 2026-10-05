import { z } from 'zod';
import { adminRoute } from '@/server/http';
import { createAdminUser, listAdminUsers } from '@/server/adminUsers';

export const dynamic = 'force-dynamic';

const body = z.object({ email: z.string().trim().email().max(320), name: z.string().trim().max(120).optional() });

export async function GET(req: Request) {
  return adminRoute(req, (db) => listAdminUsers(db));
}

/** Crea un usuario con contraseña temporal aleatoria (se muestra una sola vez; debe cambiarla al entrar). */
export async function POST(req: Request) {
  return adminRoute(
    req,
    async (db, admin) => {
      const b = body.parse(await req.json());
      const { user, temporaryPassword } = await createAdminUser(db, { ...b, actor: admin });
      return { user, temporaryPassword };
    },
    { mutation: true },
  );
}
