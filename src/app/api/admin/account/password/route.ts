import { z } from 'zod';
import { adminRoute } from '@/server/http';
import { changeOwnPassword } from '@/server/adminUsers';
import { startSession } from '@/server/adminAuth';

export const dynamic = 'force-dynamic';

/** Cambia la propia contraseña (permitido aunque esté pendiente el cambio obligatorio) y renueva la sesión. */
export async function POST(req: Request) {
  return adminRoute(
    req,
    async (db, admin) => {
      const b = z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(200) }).parse(await req.json());
      const user = await changeOwnPassword(db, admin, b.current, b.next);
      await startSession(user.email, user.tokenVersion); // la versión cambió: las demás sesiones quedan cerradas
      return { ok: true };
    },
    { mutation: true, allowMustChange: true },
  );
}
