import Link from 'next/link';

export function AdminNav({ email }: { email: string }) {
  return (
    <nav className="admin-nav" aria-label="Panel del equipo">
      <div className="admin-nav-in">
        <span className="logo">Háptica</span>
        <Link href="/admin">Invitaciones</Link>
        <a href="/api/admin/export?format=xlsx">Exportar Excel</a>
        <a href="/api/admin/export?format=csv">Exportar CSV</a>
        <a href="/api/admin/export?format=csv&hoja=respuestas">CSV de respuestas</a>
        <form action="/api/auth/logout" method="post">
          <span>{email}</span>
          <button type="submit">Salir</button>
        </form>
      </div>
    </nav>
  );
}
