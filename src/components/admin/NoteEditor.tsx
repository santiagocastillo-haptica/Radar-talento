'use client';

import { useState } from 'react';
import { adminFetch } from './adminFetch';

export function NoteEditor({ invitationId, part, initial }: { invitationId: string; part: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save() {
    if (text === saved) return;
    setState('saving');
    const res = await adminFetch('PUT', `/api/admin/invitations/${invitationId}/notes`, { part, note: text });
    if (res.ok) {
      setSaved(text);
      setState('saved');
    } else setState('error');
  }

  const id = `note-${part}`;
  return (
    <div>
      <label htmlFor={id}>Notas del evaluador · Parte {part}</label>
      <textarea id={id} rows={3} value={text} onChange={(e) => setText(e.target.value)} onBlur={save} placeholder="Observaciones para la entrevista…" />
      <div className="small muted" role="status" aria-live="polite">
        {state === 'saving' ? 'Guardando…' : state === 'saved' ? 'Guardado' : state === 'error' ? 'No se pudo guardar: reintenta' : 'Se guarda al salir del campo'}
      </div>
    </div>
  );
}
