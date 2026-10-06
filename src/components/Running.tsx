'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnswerInput, AttemptView, QuestionView, SavedAnswer, SaveResult, SignalInput } from '@/lib/api-types';
import { formatClock, remainingMs, serverNowMs, type ClockSync } from '@/lib/clock';
import { countWords } from '@/lib/words';
import { Blocks } from './Blocks';
import { ImageAttach } from './ImageAttach';
import type { Call } from './AttemptApp';

type RunningView = Extract<AttemptView, { status: 'en_curso' }>;

const AUTOSAVE_MS = 5000;
const RESYNC_MS = 30000;

type QueuedSignal = { s: SignalInput; p: number }; // p = performance.now() cuando ocurrió

function limitState(questions: QuestionView[], answers: Record<string, SavedAnswer>, groupLimit: number | null) {
  const blocked = new Set<string>();
  let total = 0;
  for (const q of questions) {
    if (q.kind !== 'open') continue;
    const w = countWords(answers[q.id]?.text);
    total += w;
    if (q.wordLimit && w > q.wordLimit) blocked.add(q.id);
  }
  const groupOver = !!groupLimit && total > groupLimit;
  if (groupOver) for (const q of questions) if (q.kind === 'open') blocked.add(q.id);
  return { blocked, total, groupOver };
}

export function Running({
  view,
  call,
  callBlob,
  syncRef,
  onView,
}: {
  view: RunningView;
  call: Call;
  callBlob: (path: string) => Promise<Blob | null>;
  syncRef: React.RefObject<ClockSync | null>;
  onView: (v: AttemptView) => void;
}) {
  const part = view.part;
  const [answers, setAnswers] = useState<Record<string, SavedAnswer>>(() => ({ ...part.saved }));
  const answersRef = useRef(answers);
  const dirty = useRef(new Set<string>());
  const signals = useRef<QueuedSignal[]>([]);
  const inflight = useRef(false);
  const again = useRef(false);
  const [deadlineAt, setDeadlineAt] = useState(view.deadlineAt);
  const [save, setSave] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'offline' | 'blocked'; at?: Date }>({ kind: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const ls = useMemo(() => limitState(part.questions, answers, part.groupWordLimit), [part, answers]);
  const unanswered = part.questions.filter((q) => (q.kind === 'open' ? !answers[q.id]?.text?.trim() : !answers[q.id]?.optionId)).length;

  const refresh = useCallback(async () => {
    const res = await call<AttemptView>('GET', '/api/attempt');
    if (!res.ok) return;
    if (res.data.status !== 'en_curso' || res.data.part.id !== part.id) {
      window.scrollTo(0, 0);
      onView(res.data);
    } else {
      setDeadlineAt(res.data.deadlineAt);
    }
  }, [call, onView, part.id]);

  const toWire = (q: QueuedSignal): SignalInput => ({ ...q.s, ageMs: Math.max(0, Math.round(performance.now() - q.p)) });

  const flush = useCallback(
    async (opts?: { keepalive?: boolean }) => {
      if (inflight.current) {
        again.current = true;
        return;
      }
      const state = limitState(part.questions, answersRef.current, part.groupWordLimit);
      const sendIds = [...dirty.current].filter((id) => !state.blocked.has(id));
      const sigs = signals.current.splice(0);
      if (!sendIds.length && !sigs.length) {
        if (dirty.current.size && state.blocked.size) setSave({ kind: 'blocked' });
        return;
      }
      inflight.current = true;
      if (sendIds.length) setSave((s) => ({ ...s, kind: 'saving' }));
      const snapshot = new Map(sendIds.map((id) => [id, JSON.stringify(answersRef.current[id] ?? {})]));
      const payload = sendIds.map((id) => {
        const a = answersRef.current[id] ?? {};
        return a.optionId !== undefined ? { questionId: id, optionId: a.optionId } : { questionId: id, text: a.text ?? '' };
      });
      const res = await call<SaveResult>('PUT', '/api/attempt/answers', { part: part.id, answers: payload, signals: sigs.map(toWire) }, opts);
      inflight.current = false;
      if (res.ok) {
        for (const id of sendIds) {
          const rejected = res.data.rejected.some((r) => r.questionId === id);
          if (!rejected && JSON.stringify(answersRef.current[id] ?? {}) === snapshot.get(id)) dirty.current.delete(id);
        }
        if (res.data.deadlineAt) setDeadlineAt(res.data.deadlineAt);
        setSave(dirty.current.size && state.blocked.size ? { kind: 'blocked' } : { kind: 'saved', at: new Date() });
      } else {
        signals.current.unshift(...sigs); // se reenvían con su edad real (p es un instante monótono)
        if (['expired', 'finished', 'wrong_part', 'not_started'].includes(res.code)) {
          void refresh();
        } else {
          setSave((s) => ({ ...s, kind: 'offline' }));
        }
      }
      if (again.current) {
        again.current = false;
        void flush();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [call, part.id, part.questions, part.groupWordLimit, refresh],
  );

  const setAnswer = (qid: string, patch: SavedAnswer) => {
    const next = { ...answersRef.current, [qid]: { ...answersRef.current[qid], ...patch } };
    answersRef.current = next;
    setAnswers(next);
    dirty.current.add(qid);
    setSave((s) => (s.kind === 'offline' ? s : { ...s, kind: 'idle' }));
  };

  // Autoguardado cada ~5 s, al salir de un campo (onBlur) y al ocultar la página.
  useEffect(() => {
    const id = setInterval(() => void flush(), AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [flush]);

  // Resincronización periódica con el servidor (también detecta un reinicio de reloj hecho por un administrador).
  useEffect(() => {
    const id = setInterval(() => void refresh(), RESYNC_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Señales: pestaña oculta / ventana sin foco. Solo conteo y duración; sin contenido.
  useEffect(() => {
    let away = false;
    let t0 = 0;
    const start = () => {
      if (away) return;
      away = true;
      t0 = performance.now();
      signals.current.push({ s: { kind: 'blur_start' }, p: t0 });
      void flush({ keepalive: true });
    };
    const end = () => {
      if (!away) return;
      away = false;
      signals.current.push({ s: { kind: 'blur_end', ms: Math.round(performance.now() - t0) }, p: performance.now() });
      void flush();
    };
    const onVis = () => (document.hidden ? start() : document.hasFocus() && end());
    window.addEventListener('blur', start);
    window.addEventListener('focus', end);
    document.addEventListener('visibilitychange', onVis);
    const onHide = () => void flush({ keepalive: true });
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('blur', start);
      window.removeEventListener('focus', end);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
    };
  }, [flush]);

  const onPaste = (qid: string, e: React.ClipboardEvent | React.DragEvent) => {
    const text = 'clipboardData' in e ? e.clipboardData?.getData('text') : (e as React.DragEvent).dataTransfer?.getData('text');
    signals.current.push({ s: { kind: 'paste', questionId: qid, chars: text?.length ?? 0 }, p: performance.now() });
  };

  const onZero = useCallback(async () => {
    // Último intento de guardar lo escrito (el servidor acepta hasta deadline + 10 s) y luego confirma el cierre.
    await flush();
    await refresh();
  }, [flush, refresh]);

  const submit = async () => {
    dialogRef.current?.close();
    setSubmitting(true);
    setSubmitError(null);
    const payload = part.questions.flatMap((q): AnswerInput[] => {
      const a = answers[q.id];
      if (q.kind === 'open') return [{ questionId: q.id, text: a?.text ?? '' }];
      return a?.optionId ? [{ questionId: q.id, optionId: a.optionId }] : [];
    });
    const res = await call<AttemptView>('POST', '/api/attempt/submit', { part: part.id, answers: payload, signals: signals.current.splice(0).map(toWire) });
    if (res.ok) {
      dirty.current.clear();
      window.scrollTo(0, 0);
      onView(res.data);
      return;
    }
    setSubmitting(false);
    if (['expired', 'finished', 'wrong_part'].includes(res.code)) {
      void refresh();
    } else if (res.code === 'over_limit') {
      setSubmitError('Hay campos por encima del límite de palabras. Redúcelos para poder enviar.');
    } else if (res.network) {
      setSubmitError('No se pudo enviar por falta de conexión. Tu texto sigue aquí; intenta de nuevo.');
    } else {
      setSubmitError(res.message);
    }
  };

  const lastPart = part.id === '3';
  const saveText =
    save.kind === 'saving'
      ? 'Guardando…'
      : save.kind === 'saved'
        ? `Guardado ${save.at!.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
        : save.kind === 'offline'
          ? 'Sin conexión: tu texto sigue en esta página y se reintenta solo. El reloj no se detiene.'
          : save.kind === 'blocked'
            ? 'Hay campos por encima del límite: no se guardan hasta que los reduzcas.'
            : dirty.current.size
              ? 'Cambios sin guardar (se guardan solos cada pocos segundos)'
              : 'Se guarda automáticamente';

  return (
    <>
      <TopBar view={view} deadlineAt={deadlineAt} syncRef={syncRef} onZero={onZero} />
      <main className="wrap" id="contenido">
        <p className="eyebrow">{part.id === '1A' || part.id === '1B' ? 'Parte 1 · ' + part.caseTitle : part.title}</p>
        <h1>{part.title}</h1>
        <span className="rail" aria-hidden="true" />

        {part.twist ? (
          <section className="card twist" aria-labelledby="novedad">
            <p className="eyebrow" id="novedad">Novedad sobre el caso</p>
            <Blocks blocks={part.twist} />
          </section>
        ) : null}

        {part.caseContext ? (
          <details className="card case" open>
            <summary>Caso: {part.caseTitle}</summary>
            <Blocks blocks={part.caseContext} />
          </details>
        ) : null}

        {part.intro.length ? <Blocks blocks={part.intro} /> : null}

        {part.groupWordLimit ? (
          <p className="card subtle" role="status" aria-live="polite">
            <strong>Límite total de la parte: {part.groupWordLimit} palabras entre los tres campos.</strong>{' '}
            <span className={ls.groupOver ? 'n over' : ''} style={ls.groupOver ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>
              Llevas {ls.total} / {part.groupWordLimit}.
            </span>
          </p>
        ) : null}

        <form onSubmit={(e) => e.preventDefault()} noValidate>
          {part.questions.map((q) =>
            q.kind === 'open' ? (
              <OpenField
                key={q.id}
                q={q}
                value={answers[q.id]?.text ?? ''}
                over={ls.blocked.has(q.id)}
                groupOver={ls.groupOver}
                limit={q.wordLimit ?? part.groupWordLimit}
                onChange={(text) => setAnswer(q.id, { text })}
                onBlur={() => void flush()}
                onPaste={(e) => onPaste(q.id, e)}
                attach={
                  q.allowImage ? (
                    <ImageAttach questionId={q.id} part={part.id} initial={part.saved[q.id]?.image} call={call} callBlob={callBlob} />
                  ) : null
                }
              />
            ) : (
              <McField
                key={q.id}
                q={q}
                value={answers[q.id]?.optionId}
                onChange={(optionId) => {
                  setAnswer(q.id, { optionId });
                  void flush();
                }}
              />
            ),
          )}
        </form>

        {part.outro ? <p className="muted">{part.outro}</p> : null}
        {submitError ? (
          <p role="alert" style={{ color: 'var(--danger)', fontWeight: 700 }}>
            {submitError}
          </p>
        ) : null}
      </main>

      <div className="savebar">
        <div className="savebar-in">
          <span className={'status-save' + (save.kind === 'offline' || save.kind === 'blocked' ? ' bad' : '')} role="status" aria-live="polite">
            {saveText}
          </span>
          <button className="btn" disabled={ls.blocked.size > 0 || submitting} onClick={() => dialogRef.current?.showModal()}>
            {submitting ? 'Enviando…' : lastPart ? 'Enviar y terminar' : 'Enviar y continuar'}
          </button>
        </div>
      </div>

      <dialog ref={dialogRef} aria-labelledby="dlg-title">
        <h2 id="dlg-title">¿Enviar {part.title}?</h2>
        <p>Al enviar, esta parte queda bloqueada y no podrás volver a ella.</p>
        {unanswered > 0 ? (
          <p className="card warn">
            Tienes {unanswered} {unanswered === 1 ? 'pregunta sin responder' : 'preguntas sin responder'}.
          </p>
        ) : null}
        <div className="dialog-actions">
          <button className="btn outline" onClick={() => dialogRef.current?.close()}>
            Volver a revisar
          </button>
          <button className="btn" onClick={submit}>
            Enviar
          </button>
        </div>
      </dialog>
    </>
  );
}

function OpenField({
  q,
  value,
  over,
  groupOver,
  limit,
  onChange,
  onBlur,
  onPaste,
  attach,
}: {
  q: QuestionView;
  value: string;
  over: boolean;
  groupOver: boolean;
  limit: number | null;
  onChange: (v: string) => void;
  onBlur: () => void;
  onPaste: (e: React.ClipboardEvent) => void;
  attach?: React.ReactNode;
}) {
  const words = countWords(value);
  return (
    <div className="q">
      <label className="q-label" htmlFor={`q${q.id}`}>
        <span className="q-num">{q.number}.</span>
        {q.prompt}
      </label>
      <textarea
        id={`q${q.id}`}
        className={over ? 'over' : undefined}
        value={value}
        rows={q.wordLimit && q.wordLimit <= 100 ? 5 : 7}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onPaste={onPaste}
        onDrop={(e) => onPaste(e as unknown as React.ClipboardEvent)}
        aria-describedby={`c${q.id}`}
        aria-invalid={over || undefined}
        autoComplete="off"
        spellCheck
      />
      <div className="counter" id={`c${q.id}`}>
        <span className={'n' + (over ? ' over' : '')}>
          {words}
          {q.wordLimit ? ` / ${q.wordLimit}` : ''} palabras
        </span>
        {over ? (
          <span className="over-msg" role="alert">
            {groupOver && !(q.wordLimit && words > q.wordLimit) ? 'El total de la parte excede el límite' : `Reduce a ${limit} palabras`}
          </span>
        ) : null}
      </div>
      {attach}
    </div>
  );
}

function McField({ q, value, onChange }: { q: QuestionView; value?: string; onChange: (optionId: string) => void }) {
  return (
    <fieldset className="q">
      <legend>
        <span className="q-num">{q.number}.</span>
        {q.prompt}
      </legend>
      {q.options!.map((o, i) => (
        <label key={o.id} className={'opt' + (value === o.id ? ' sel' : '')}>
          <input type="radio" name={`q${q.id}`} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
          <span className="letter" aria-hidden="true">
            {'ABCD'[i]}.
          </span>
          <span>{o.text}</span>
        </label>
      ))}
    </fieldset>
  );
}

function TopBar({
  view,
  deadlineAt,
  syncRef,
  onZero,
}: {
  view: RunningView;
  deadlineAt: string;
  syncRef: React.RefObject<ClockSync | null>;
  onZero: () => Promise<void>;
}) {
  const part = view.part;
  const [, setTick] = useState(0);
  const zeroHandled = useRef(false);
  const [announce, setAnnounce] = useState('');
  const announced = useRef(new Set<number>());

  const sync = syncRef.current ?? { serverMs: Date.parse(view.serverNow), perfMs: performance.now() };
  const perf = performance.now();
  const remaining = remainingMs(deadlineAt, sync, perf);
  const elapsedInPartMs = Math.max(0, serverNowMs(sync, perf) - Date.parse(part.startedAt));
  const suggestedMs = part.suggestedMinutes * 60_000;

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (remaining > 0) {
      zeroHandled.current = false;
      for (const m of [30, 10, 5, 1]) {
        if (remaining <= m * 60_000 && remaining > (m - 0.5) * 60_000 && !announced.current.has(m)) {
          announced.current.add(m);
          setAnnounce(`Quedan ${m} ${m === 1 ? 'minuto' : 'minutos'}.`);
        }
      }
      return;
    }
    if (!zeroHandled.current) {
      zeroHandled.current = true;
      const run = async () => {
        await onZero();
        // Si el servidor aún no considera vencido el plazo (desfase de milisegundos), reintenta.
        setTimeout(() => {
          if (zeroHandled.current) void onZero();
        }, 1500);
      };
      void run();
    }
  }, [remaining, onZero]);

  const ids = view.partOrder;
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <nav className="steps" aria-label="Progreso de la prueba">
            {ids.map((id) => (
              <span key={id} className={'step' + (id === part.id ? ' cur' : view.doneParts.includes(id) ? ' done' : '')} aria-current={id === part.id ? 'step' : undefined}>
                {id}
                <span className="sr-only">{view.doneParts.includes(id) ? ' (enviada)' : id === part.id ? ' (actual)' : ' (pendiente)'}</span>
              </span>
            ))}
          </nav>
          <div className={'clock' + (remaining < 5 * 60_000 ? ' low' : '')} role="timer" aria-label="Tiempo restante">
            <small>Tiempo restante</small>
            {formatClock(remaining)}
          </div>
        </div>
      </header>
      <div className="suggest">
        <div className="suggest-in">
          <span>
            Tiempo sugerido para esta parte: <strong>{part.suggestedMinutes} min</strong> (orientativo) · llevas {Math.floor(elapsedInPartMs / 60_000)} min
          </span>
          <span className="bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (elapsedInPartMs / suggestedMs) * 100)}%` }} />
          </span>
        </div>
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>
    </>
  );
}
