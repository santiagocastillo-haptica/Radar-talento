'use client';

import { useState } from 'react';
import { adminFetch } from './adminFetch';
import { EVAL_STATUS_LABEL, EVAL_STATUSES, type EvalStatus } from '@/content/rubric';

/** Selector de estado por habilidad/indicador. Sin puntajes: solo Evidencia sólida / Indicio / Sin evidencia suficiente. */
export function EvalSelector({ invitationId, evalKey, label, initial }: { invitationId: string; evalKey: string; label: string; initial: EvalStatus | null }) {
  const [value, setValue] = useState<EvalStatus | null>(initial);
  const [error, setError] = useState<string | null>(null);

  async function pick(next: EvalStatus) {
    const target = value === next ? null : next; // clic de nuevo = limpiar
    const prev = value;
    setValue(target);
    setError(null);
    const res = await adminFetch('PUT', `/api/admin/invitations/${invitationId}/evaluation`, { key: evalKey, status: target });
    if (!res.ok) {
      setValue(prev);
      setError(res.message);
    }
  }

  return (
    <div>
      <div className="seg" role="group" aria-label={`Estado de ${label}`}>
        {EVAL_STATUSES.map((s) => (
          <button key={s} type="button" aria-pressed={value === s} onClick={() => pick(s)}>
            {EVAL_STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {error ? <div role="alert" className="small" style={{ color: 'var(--danger)' }}>{error}</div> : null}
    </div>
  );
}
