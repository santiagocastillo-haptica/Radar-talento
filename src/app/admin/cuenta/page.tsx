import { redirect } from 'next/navigation';
import { currentAdminSession } from '@/server/adminAuth';
import { AdminNav } from '@/components/admin/AdminNav';
import { AccountForm } from '@/components/admin/AccountForm';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const s = await currentAdminSession();
  if (!s) redirect('/admin/login');
  return (
    <>
      <AdminNav email={s.email} locked={s.mustChange} />
      <main className="wrap">
        <p className="eyebrow">Mi cuenta</p>
        <h1>{s.mustChange ? 'Cambia tu contraseña' : 'Cambiar contraseña'}</h1>
        <span className="rail" aria-hidden="true" />
        {s.mustChange ? (
          <div className="card warn" role="note">
            <p>Estás usando una contraseña temporal. Para continuar, elige una contraseña propia.</p>
          </div>
        ) : null}
        <AccountForm forced={s.mustChange} />
      </main>
    </>
  );
}
