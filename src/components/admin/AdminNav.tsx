import Link from 'next/link';

export function AdminNav({ email, locked = false }: { email: string; locked?: boolean }) {
  return (
    <nav className="admin-nav" aria-label="Panel del equipo">
      <div className="admin-nav-in">
        <span className="logo">Háptica</span>
        {locked ? null : (
          <>
            <Link href="/admin">Invitaciones</Link>
            <Link href="/admin/usuarios">Usuarios</Link>
            <a href="/api/admin/export?format=xlsx">Exportar Excel</a>
            <a href="/api/admin/export?format=csv">Exportar CSV</a>
            <a href="/api/admin/export?format=csv&hoja=respuestas">CSV de respuestas</a>
          </>
        )}
        <form action="/api/auth/logout" method="post">
          {locked ? <span>{email}</span> : <Link href="/admin/cuenta">{email}</Link>}
          <button type="submit">Salir</button>
        </form>
      </div>
    </nav>
  );
}
