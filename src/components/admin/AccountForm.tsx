'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from './adminFetch';

export function AccountForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (fd.get('next') !== fd.get('confirm')) return setMsg({ ok: false, text: 'La confirmación no coincide con la contraseña nueva.' });
    setBusy(true);
    setMsg(null);
    const res = await adminFetch('POST', '/api/admin/account/password', { current: fd.get('current'), next: fd.get('next') });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.message });
    form.reset();
    setMsg({ ok: true, text: 'Contraseña actualizada.' });
    if (forced) router.replace('/admin');
    else router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 480 }}>
      <p>
        <label htmlFor="current">Contraseña actual{forced ? ' (la temporal que recibiste)' : ''}</label>
        <input id="current" name="current" type="password" required autoComplete="current-password" />
      </p>
      <p>
        <label htmlFor="next">Contraseña nueva (mínimo 12 caracteres)</label>
        <input id="next" name="next" type="password" required minLength={12} autoComplete="new-password" />
      </p>
      <p>
        <label htmlFor="confirm">Confirma la contraseña nueva</label>
        <input id="confirm" name="confirm" type="password" required minLength={12} autoComplete="new-password" />
      </p>
      <button className="btn" disabled={busy}>
        {busy ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
      {msg ? (
        <p role={msg.ok ? 'status' : 'alert'} style={{ color: msg.ok ? 'var(--verde-petroleo)' : 'var(--danger)', fontWeight: 700 }}>
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}
