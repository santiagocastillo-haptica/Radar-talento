'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AttemptView } from '@/lib/api-types';
import { makeSync, type ClockSync } from '@/lib/clock';
import { Running } from './Running';

export type ApiResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string; extra?: any; network?: boolean };

export type Call = <T = any>(method: string, path: string, body?: unknown, opts?: { keepalive?: boolean }) => Promise<ApiResult<T>>;

const TOKEN_KEY = 'hx_attempt_token';

function readToken(): string | null {
  const fromHash = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim();
  try {
    if (fromHash) {
      sessionStorage.setItem(TOKEN_KEY, fromHash);
      return fromHash;
    }
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return fromHash || null;
  }
}

export function AttemptApp() {
  const [view, setView] = useState<AttemptView | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const syncRef = useRef<ClockSync | null>(null);

  const call: Call = useCallback(async (method, path, body, opts) => {
    const p0 = performance.now();
    try {
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Attempt-Token': tokenRef.current ?? '' },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        keepalive: opts?.keepalive,
      });
      const p1 = performance.now();
      const json = await res.json().catch(() => null);
      if (res.ok) {
        // La hora del servidor es la única referencia: se ancla a un reloj monótono (no al reloj del equipo).
        if (json?.serverNow) syncRef.current = makeSync(json.serverNow, p0, p1);
        return { ok: true, data: json };
      }
      return { ok: false, status: res.status, code: json?.error?.code ?? 'error', message: json?.error?.message ?? 'Error', extra: json?.error };
    } catch {
      return { ok: false, status: 0, code: 'network', message: 'Sin conexión', network: true };
    }
  }, []);

  const load = useCallback(async () => {
    const res = await call<AttemptView>('GET', '/api/attempt');
    if (res.ok) {
      setView(res.data);
      setFatal(null);
    } else if (res.code === 'invalid_token') {
      setFatal('Este enlace no es válido. Revisa que lo hayas copiado completo o pide uno nuevo al equipo de Háptica.');
    } else if (res.code === 'rate_limited') {
      setFatal('Demasiados intentos. Espera unos minutos y vuelve a abrir el enlace.');
    } else if (res.network) {
      setFatal('No pudimos conectarnos. Revisa tu conexión y recarga la página: tu tiempo, si ya empezaste, sigue corriendo.');
    } else {
      setFatal('Ocurrió un error inesperado. Recarga la página.');
    }
  }, [call]);

  useEffect(() => {
    tokenRef.current = readToken();
    if (!tokenRef.current) {
      setFatal('Falta el enlace de invitación. Abre el enlace completo que te enviamos.');
      return;
    }
    void load();
  }, [load]);

  if (fatal) return <Shell><div className="card warn" role="alert"><p>{fatal}</p></div></Shell>;
  if (!view) return <Shell><p className="muted" role="status">Cargando…</p></Shell>;

  switch (view.status) {
    case 'vencida':
      return (
        <Shell>
          <h1>Este enlace venció</h1>
          <span className="rail" aria-hidden="true" />
          <p>Hola, {view.name}. El enlace de la prueba era válido por 24 horas y no se inició a tiempo. Escríbele al equipo de Háptica para recibir uno nuevo.</p>
        </Shell>
      );
    case 'enviada':
      return (
        <Shell>
          <h1>Gracias, {view.name}</h1>
          <span className="rail" aria-hidden="true" />
          <p>Recibimos tus respuestas. Ya puedes cerrar esta página.</p>
        </Shell>
      );
    case 'expirada':
      return (
        <Shell>
          <h1>Se terminó el tiempo</h1>
          <span className="rail" aria-hidden="true" />
          <p>Gracias, {view.name}. La prueba se cerró con lo que tenías guardado. Ya puedes cerrar esta página.</p>
        </Shell>
      );
    case 'creada':
      return <Welcome view={view} call={call} onView={setView} />;
    case 'en_curso':
      return <Running key={view.part.id} view={view} call={call} syncRef={syncRef} onView={setView} />;
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="wrap">
      <p className="eyebrow">Háptica · Prueba de selección</p>
      {children}
    </main>
  );
}

function Welcome({ view, call, onView }: { view: Extract<AttemptView, { status: 'creada' }>; call: Call; onView: (v: AttemptView) => void }) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    const res = await call<AttemptView>('POST', '/api/attempt/start', { accepted: true });
    if (res.ok) {
      window.scrollTo(0, 0);
      onView(res.data);
    } else {
      setBusy(false);
      setError(res.code === 'link_expired' ? 'El enlace venció.' : res.network ? 'No hay conexión. Intenta de nuevo.' : res.message);
    }
  };

  return (
    <Shell>
      <h1>Hola, {view.name}</h1>
      <p className="muted">Prueba para el rol de {view.roleLabel}</p>
      <span className="rail" aria-hidden="true" />

      <section className="card" aria-labelledby="reglas">
        <h2 id="reglas">Antes de comenzar</h2>
        <p>{view.rulesText}</p>
        <p className="small muted">
          Tiempos sugeridos por parte (orientativos, no son límites):{' '}
          {view.parts.map((p, i) => (
            <span key={p.id}>
              {i > 0 ? ' · ' : ''}
              {p.id}: {p.suggestedMinutes} min
            </span>
          ))}
          . El único límite duro es el reloj total de {view.durationMinutes} minutos.
        </p>
      </section>

      <section className="card subtle" aria-labelledby="datos">
        <h2 id="datos">Datos personales y señales registradas</h2>
        <p>
          Registramos tus respuestas, el tiempo por parte y algunas señales de uso de la página (pegado de texto, cambios de pestaña y el ritmo de escritura). Pegar texto es normal, también si viene de una herramienta de IA: lo usamos solo para conversar contigo después. No usamos cámara, micrófono, grabación de pantalla ni identificación del dispositivo.
        </p>
        {view.privacyUrl ? (
          <p>
            <a href={view.privacyUrl} target="_blank" rel="noopener noreferrer">
              Política de tratamiento de datos personales de Háptica
            </a>
          </p>
        ) : null}
      </section>

      <div className="card ok" role="note">
        <strong>El reloj NO corre en esta pantalla.</strong> Empieza a contar cuando presionas “Comenzar” y no se detiene aunque cierres la página; si vuelves a abrir el enlace, continúas donde ibas con el tiempo restante.
      </div>

      <label className="checkrow">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>He leído las reglas y acepto el tratamiento de datos y el registro de señales descrito arriba.</span>
      </label>
      {error ? <p role="alert" style={{ color: 'var(--danger)', fontWeight: 700 }}>{error}</p> : null}
      <button className="btn" disabled={!accepted || busy} onClick={start}>
        {busy ? 'Iniciando…' : 'Comenzar'}
      </button>
    </Shell>
  );
}
