'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from './adminFetch';
import { CopyButton } from './CreateInvitation';

export function CandidateActions({ id, canReset, canRegenerate }: { id: string; canReset: boolean; canRegenerate: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setError(null);
    const res = await adminFetch('POST', `/api/admin/invitations/${id}/reset`, { reason });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    dialog.current?.close();
    setReason('');
    router.refresh();
  }

  async function regenerate() {
    if (!window.confirm('El enlace anterior dejará de funcionar y se emitirá uno nuevo válido por 24 h. ¿Continuar?')) return;
    setBusy(true);
    const res = await adminFetch<{ link: string }>('POST', `/api/admin/invitations/${id}/regenerate`);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setLink(res.data.link);
    router.refresh();
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {canReset ? (
          <button className="btn sm outline" onClick={() => dialog.current?.showModal()}>
            Reiniciar reloj
          </button>
        ) : null}
        {canRegenerate ? (
          <button className="btn sm outline" onClick={regenerate} disabled={busy}>
            Regenerar enlace
          </button>
        ) : null}
        <a className="btn sm outline" href="/api/admin/export?format=xlsx">
          Exportar Excel
        </a>
      </div>
      {error ? <p role="alert" style={{ color: 'var(--danger)', fontWeight: 700 }}>{error}</p> : null}
      {link ? (
        <div className="card ok" style={{ marginTop: 12 }} role="status">
          <p>Nuevo enlace (no se vuelve a mostrar):</p>
          <p className="link-box">{link}</p>
          <CopyButton text={link} />
        </div>
      ) : null}

      <dialog ref={dialog} aria-labelledby="reset-title">
        <h2 id="reset-title">Reiniciar el reloj</h2>
        <p>
          El candidato recibirá una ventana completa nueva desde este momento. Se conserva lo que ya escribió y las partes enviadas siguen bloqueadas. Queda un registro inmutable con quién, cuándo, el motivo y la hora de inicio anterior.
        </p>
        <label htmlFor="reset-reason">Motivo (obligatorio)</label>
        <textarea id="reset-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: falla de conexión del candidato confirmada con soporte" />
        <div className="dialog-actions">
          <button className="btn outline" onClick={() => dialog.current?.close()}>
            Cancelar
          </button>
          <button className="btn accent" disabled={busy || reason.trim().length < 5} onClick={reset}>
            Reiniciar reloj
          </button>
        </div>
      </dialog>
    </div>
  );
}
