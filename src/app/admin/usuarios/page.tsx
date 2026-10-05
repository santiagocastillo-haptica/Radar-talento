import { requireAdminPage } from '@/server/adminAuth';
import { getStore } from '@/server/store';
import { listAdminUsers } from '@/server/adminUsers';
import { AdminNav } from '@/components/admin/AdminNav';
import { UsersPanel } from '@/components/admin/UsersPanel';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const me = await requireAdminPage();
  const users = await listAdminUsers(await getStore());
  return (
    <>
      <AdminNav email={me} />
      <main className="wrap wide">
        <p className="eyebrow">Panel del equipo</p>
        <h1>Usuarios</h1>
        <span className="rail" aria-hidden="true" />
        <UsersPanel users={users} me={me} />
      </main>
    </>
  );
}
