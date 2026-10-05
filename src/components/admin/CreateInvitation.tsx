'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from './adminFetch';

export function CopyButton({ text, label = 'Copiar enlace' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn sm outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt('Copia el enlace:', text);
        }
      }}
    >
      {done ? 'Copiado ✓' : label}
    </button>
  );
}

export function CreateInvitation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ link: string; expiresAt: string; name: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setError(null);
    const res = await adminFetch<{ link: string; expiresAt: string }>('POST', '/api/admin/invitations', {
      name: fd.get('name'),
      email: fd.get('email'),
      role: fd.get('role'),
    });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setCreated({ ...res.data, name: String(fd.get('name')) });
    form.reset();
    router.refresh();
  }

  return (
    <section className="card" aria-labelledby="nueva">
      <h2 id="nueva">Nueva invitación</h2>
      <form onSubmit={onSubmit} className="grid-form">
        <div>
          <label htmlFor="inv-name">Nombre</label>
          <input id="inv-name" name="name" type="text" required minLength={2} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="inv-email">Correo</label>
          <input id="inv-email" name="email" type="email" required autoComplete="off" />
        </div>
        <div>
          <label htmlFor="inv-role">Rol</label>
          <select id="inv-role" name="role" defaultValue="service_designer">
            <option value="service_designer">Service Designer</option>
            <option value="legal_service_designer">Legal Service Designer</option>
          </select>
        </div>
        <button className="btn" disabled={busy}>
          {busy ? 'Creando…' : 'Crear invitación'}
        </button>
      </form>
      {error ? <p role="alert" style={{ color: 'var(--danger)', fontWeight: 700 }}>{error}</p> : null}
      {created ? (
        <div className="card ok" style={{ marginTop: 16 }} role="status">
          <p>
            <strong>Enlace para {created.name}.</strong> Cópialo y envíaselo ahora: <strong>por seguridad no se vuelve a mostrar</strong> (solo guardamos su huella). Si lo pierdes, usa “Regenerar enlace” en el detalle. Vence el{' '}
            {new Date(created.expiresAt).toLocaleString('es-CO')} si la persona no inicia la prueba.
          </p>
          <p className="link-box">{created.link}</p>
          <CopyButton text={created.link} />
        </div>
      ) : null}
    </section>
  );
}
