'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from './adminFetch';
import { CopyButton } from './CreateInvitation';

interface U {
  email: string;
  name: string;
  active: boolean;
  mustChange: boolean;
  lastLoginAt: string | null;
}

export function UsersPanel({ users, me }: { users: U[]; me: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setError(null);
    const res = await adminFetch<{ temporaryPassword: string }>('POST', '/api/admin/users', { email: fd.get('email'), name: fd.get('name') });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setSecret({ email: String(fd.get('email')).toLowerCase(), password: res.data.temporaryPassword });
    form.reset();
    router.refresh();
  }

  async function reset(email: string) {
    if (!window.confirm(`Se generará una contraseña temporal para ${email} y se cerrarán sus sesiones. ¿Continuar?`)) return;
    setError(null);
    const res = await adminFetch<{ temporaryPassword: string }>('POST', '/api/admin/users/reset', { email });
    if (!res.ok) return setError(res.message);
    setSecret({ email, password: res.data.temporaryPassword });
    router.refresh();
  }

  async function remove(email: string) {
    if (!window.confirm(`Se eliminará definitivamente la cuenta de ${email}. Esta acción no se puede deshacer. ¿Continuar?`)) return;
    setError(null);
    const res = await adminFetch('POST', '/api/admin/users/delete', { email });
    if (!res.ok) return setError(res.message);
    router.refresh();
  }

  async function toggle(email: string, active: boolean) {
    setError(null);
    const res = await adminFetch('POST', '/api/admin/users/active', { email, active });
    if (!res.ok) return setError(res.message);
    router.refresh();
  }

  return (
    <>
      <section className="card" aria-labelledby="nuevo-usuario">
        <h2 id="nuevo-usuario">Agregar persona al panel</h2>
        <form onSubmit={create} className="grid-form" style={{ gridTemplateColumns: '1.3fr 1.3fr auto' }}>
          <div>
            <label htmlFor="u-name">Nombre</label>
            <input id="u-name" name="name" type="text" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="u-email">Correo</label>
            <input id="u-email" name="email" type="email" required autoComplete="off" />
          </div>
          <button className="btn" disabled={busy}>
            {busy ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
        <p className="small muted">
          Se genera una contraseña temporal que se muestra una sola vez; la persona deberá cambiarla al entrar. Sirve cualquier correo (no depende de Google ni de Microsoft).
        </p>
        {error ? (
          <p role="alert" style={{ color: 'var(--danger)', fontWeight: 700 }}>
            {error}
          </p>
        ) : null}
        {secret ? (
          <div className="card ok" role="status" style={{ marginTop: 16 }}>
            <p>
              <strong>Contraseña temporal para {secret.email}.</strong> Compártela por un canal seguro; <strong>no se vuelve a mostrar</strong>.
            </p>
            <p className="link-box">{secret.password}</p>
            <CopyButton text={secret.password} label="Copiar contraseña" />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="usuarios">
        <h2 id="usuarios">Personas con acceso ({users.length})</h2>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Usuarios del panel">
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Estado</th>
                <th>Último ingreso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email}>
                  <td>
                    <strong>{u.name || u.email}</strong>
                    {u.name ? (
                      <>
                        <br />
                        <span className="small muted">{u.email}</span>
                      </>
                    ) : null}
                    {u.email === me ? <span className="pill"> tú</span> : null}
                  </td>
                  <td>
                    <span className={`badge ${u.active ? 'en_curso' : 'vencida'}`}>{u.active ? 'Activa' : 'Desactivada'}</span>
                    {u.mustChange ? <span className="small muted"> · pendiente de cambiar contraseña</span> : null}
                  </td>
                  <td>
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })
                      : '—'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn sm outline" onClick={() => reset(u.email)}>
                      Restablecer contraseña
                    </button>{' '}
                    {u.email !== me ? (
                      <button className="btn sm outline" onClick={() => toggle(u.email, !u.active)}>
                        {u.active ? 'Desactivar' : 'Reactivar'}
                      </button>
                    ) : null}{' '}
                    {u.email !== me && !u.active ? (
                      <button className="btn sm outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => remove(u.email)}>
                        Eliminar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
