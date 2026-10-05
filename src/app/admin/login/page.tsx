import { redirect } from 'next/navigation';
import { currentAdminSession } from '@/server/adminAuth';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  bad_credentials: 'Correo o contraseña incorrectos.',
  rate_limited: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  bad_origin: 'No se pudo validar el origen de la solicitud. Recarga la página.',
  server: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentAdminSession()) redirect('/admin');
  const { error } = await searchParams;
  return (
    <main className="wrap" style={{ maxWidth: 480 }}>
      <p className="eyebrow">Háptica · Panel del equipo</p>
      <h1>Entrar</h1>
      <span className="rail" aria-hidden="true" />
      {error ? (
        <div className="card warn" role="alert">
          <p>{ERRORS[error] ?? 'No se pudo entrar.'}</p>
        </div>
      ) : null}
      <form action="/api/auth/login" method="post">
        <p>
          <label htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" required autoComplete="username" autoFocus />
        </p>
        <p>
          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </p>
        <button className="btn" type="submit">
          Entrar
        </button>
      </form>
      <p className="small muted" style={{ marginTop: 24 }}>
        ¿No tienes acceso o olvidaste tu contraseña? Pídele a otra persona administradora del panel que te cree una cuenta o restablezca tu contraseña.
      </p>
    </main>
  );
}
