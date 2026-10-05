import { redirect } from 'next/navigation';
import { currentAdmin, devLoginEnabled, microsoftConfigured } from '@/server/adminAuth';
import { config } from '@/server/config';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  denied: 'Esa cuenta no está autorizada para el panel. Usa tu cuenta de Háptica.',
  oauth: 'No se pudo completar el inicio de sesión. Inténtalo de nuevo.',
  ms_not_configured: 'El inicio de sesión con Microsoft no está configurado (faltan MS_TENANT_ID, MS_CLIENT_ID o MS_CLIENT_SECRET).',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentAdmin()) redirect('/admin');
  const { error } = await searchParams;
  const c = config();
  return (
    <main className="wrap">
      <p className="eyebrow">Háptica · Panel del equipo</p>
      <h1>Entrar</h1>
      <span className="rail" aria-hidden="true" />
      {error ? (
        <div className="card warn" role="alert">
          <p>{ERRORS[error] ?? 'No se pudo entrar.'}</p>
        </div>
      ) : null}
      <p>El acceso es solo para cuentas @{c.adminDomain}.</p>
      {microsoftConfigured() ? (
        <a className="btn" href="/api/auth/login">
          Entrar con Microsoft
        </a>
      ) : (
        <p className="muted">El inicio de sesión con Microsoft no está configurado en este entorno.</p>
      )}
      {devLoginEnabled() ? (
        <form action="/api/auth/dev-login" method="post" className="card subtle" style={{ marginTop: 24 }}>
          <p className="eyebrow">Solo desarrollo local</p>
          <label htmlFor="dev-email">Correo @{c.adminDomain}</label>
          <input id="dev-email" name="email" type="email" required defaultValue={`dev@${c.adminDomain}`} />
          <p />
          <button className="btn outline" type="submit">
            Entrar (sin Microsoft)
          </button>
        </form>
      ) : null}
    </main>
  );
}
