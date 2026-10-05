'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from './adminFetch';
import { CopyButton } from './CreateInvitation';

export function CandidateActions({
  id,
  name,
  canReset,
  canRegenerate,
  inProgress,
}: {
  id: string;
  name: string;
  canReset: boolean;
  canRegenerate: boolean;
  inProgress: boolean;
}) {
  const router = useRouter();
  const resetDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [delReason, setDelReason] = useState('');
  const [delName, setDelName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setError(null);
    const res = await adminFetch('POST', `/api/admin/invitations/${id}/reset`, { reason });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    resetDialog.current?.close();
    setReason('');
    router.refresh();
  }

  async function regenerate() {
    const msg = inProgress
      ? 'La persona está en curso: el enlace anterior dejará de funcionar y recibirás uno nuevo. El reloj NO se reinicia ni se detiene. ¿Continuar?'
      : 'El enlace anterior dejará de funcionar y se emitirá uno nuevo válido por 24 h. ¿Continuar?';
    if (!window.confirm(msg)) return;
    setBusy(true);
    setError(null);
    const res = await adminFetch<{ link: string }>('POST', `/api/admin/invitations/${id}/regenerate`);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setLink(res.data.link);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await adminFetch('POST', `/api/admin/invitations/${id}/delete`, { reason: delReason, confirmName: delName });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    deleteDialog.current?.close();
    router.replace('/admin');
    router.refresh();
  }

  const nameMatches = delName.trim().toLowerCase() === name.trim().toLowerCase();

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {canReset ? (
          <button className="btn sm outline" onClick={() => resetDialog.current?.showModal()}>
            Reiniciar reloj
          </button>
        ) : null}
        {canRegenerate ? (
          <button className="btn sm outline" onClick={regenerate} disabled={busy}>
            {inProgress ? 'Enlace perdido: generar uno nuevo' : 'Regenerar enlace'}
          </button>
        ) : null}
        <a className="btn sm outline" href="/api/admin/export?format=xlsx">
          Exportar Excel
        </a>
        <button className="btn sm outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => deleteDialog.current?.showModal()}>
          Eliminar invitación
        </button>
      </div>
      {error ? (
        <p role="alert" style={{ color: 'var(--danger)', fontWeight: 700 }}>
          {error}
        </p>
      ) : null}
      {link ? (
        <div className="card ok" style={{ marginTop: 12 }} role="status">
          <p>Nuevo enlace (no se vuelve a mostrar). Envíaselo a la persona: el anterior ya no funciona.</p>
          <p className="link-box">{link}</p>
          <CopyButton text={link} />
        </div>
      ) : null}

      <dialog ref={resetDialog} aria-labelledby="reset-title">
        <h2 id="reset-title">Reiniciar el reloj</h2>
        <p>
          El candidato recibirá una ventana completa nueva desde este momento. Se conserva lo que ya escribió y las partes enviadas siguen bloqueadas. Queda un registro inmutable con quién, cuándo, el motivo y la hora de inicio anterior.
        </p>
        <label htmlFor="reset-reason">Motivo (obligatorio)</label>
        <textarea id="reset-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: falla de conexión del candidato confirmada con soporte" />
        <div className="dialog-actions">
          <button className="btn outline" onClick={() => resetDialog.current?.close()}>
            Cancelar
          </button>
          <button className="btn accent" disabled={busy || reason.trim().length < 5} onClick={reset}>
            Reiniciar reloj
          </button>
        </div>
      </dialog>

      <dialog ref={deleteDialog} aria-labelledby="del-title">
        <h2 id="del-title">Eliminar la invitación de {name}</h2>
        <p>
          <strong>Es definitivo.</strong> Se borran la invitación y todo lo asociado: respuestas, señales, estados por habilidad y notas. No se puede deshacer. En el registro de auditoría queda quién lo hizo, cuándo y por qué, <strong>sin el nombre ni el correo</strong> de la persona.
        </p>
        <p className="small muted">Si solo necesitas conservar los resultados, exporta antes a Excel.</p>
        <label htmlFor="del-reason">Motivo (obligatorio)</label>
        <textarea id="del-reason" rows={2} value={delReason} onChange={(e) => setDelReason(e.target.value)} placeholder="Ej.: la persona pidió la eliminación de sus datos / invitación creada por error" />
        <p />
        <label htmlFor="del-name">Para confirmar, escribe el nombre: {name}</label>
        <input id="del-name" type="text" value={delName} onChange={(e) => setDelName(e.target.value)} autoComplete="off" />
        <div className="dialog-actions">
          <button className="btn outline" onClick={() => deleteDialog.current?.close()}>
            Cancelar
          </button>
          <button className="btn accent" disabled={busy || delReason.trim().length < 5 || !nameMatches} onClick={remove}>
            Eliminar definitivamente
          </button>
        </div>
      </dialog>
    </div>
  );
}
