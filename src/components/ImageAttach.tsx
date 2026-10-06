'use client';

import { useEffect, useRef, useState } from 'react';
import type { PartId } from '@/content/types';
import type { Call } from './AttemptApp';

const TARGET_BYTES = 540 * 1024; // el servidor admite hasta 600 KB
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

/** Reduce y recomprime la imagen en el navegador (JPEG, lado mayor ≤ 1600 px) hasta caber en el tope. */
async function shrink(file: File): Promise<{ blob: Blob; base64: string }> {
  const bmp = await createImageBitmap(file);
  let maxEdge = 1600;
  let quality = 0.82;
  for (let i = 0; i < 8; i++) {
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; // PNG con transparencia → fondo blanco
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (blob && blob.size <= TARGET_BYTES) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let j = 0; j < bytes.length; j += 0x8000) bin += String.fromCharCode(...bytes.subarray(j, j + 0x8000));
      bmp.close?.();
      return { blob, base64: btoa(bin) };
    }
    if (quality > 0.55) quality -= 0.1;
    else maxEdge = Math.round(maxEdge * 0.8);
  }
  bmp.close?.();
  throw new Error('too_large');
}

export function ImageAttach({
  questionId,
  part,
  initial,
  call,
  callBlob,
}: {
  questionId: string;
  part: PartId;
  initial?: { mime: string; size: number };
  call: Call;
  callBlob: (path: string) => Promise<Blob | null>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [has, setHas] = useState(!!initial);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Si ya había una imagen guardada (p. ej. tras recargar), se vuelve a pedir para mostrarla.
  useEffect(() => {
    if (!initial) return;
    let url: string | null = null;
    let cancelled = false;
    void callBlob(`/api/attempt/attachment?q=${encodeURIComponent(questionId)}`).then((b) => {
      if (b && !cancelled) {
        url = URL.createObjectURL(b);
        setPreview(url);
      }
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMsg(null);
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return setMsg({ ok: false, text: 'Usa una imagen JPG, PNG o WebP.' });
    if (file.size > MAX_INPUT_BYTES) return setMsg({ ok: false, text: 'La imagen es demasiado pesada (máx. 20 MB).' });
    setBusy(true);
    try {
      const { blob, base64 } = await shrink(file);
      const res = await call('PUT', '/api/attempt/attachment', { part, questionId, data: base64 });
      if (!res.ok) {
        setMsg({ ok: false, text: res.network ? 'Sin conexión: intenta de nuevo.' : res.message });
      } else {
        setPreview(URL.createObjectURL(blob));
        setHas(true);
        setMsg({ ok: true, text: 'Imagen adjunta y guardada.' });
      }
    } catch {
      setMsg({ ok: false, text: 'No se pudo procesar la imagen. Prueba con otra (JPG o PNG).' });
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    setMsg(null);
    const res = await call('DELETE', '/api/attempt/attachment', { part, questionId });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.network ? 'Sin conexión: intenta de nuevo.' : res.message });
    setPreview(null);
    setHas(false);
    setMsg({ ok: true, text: 'Imagen quitada.' });
  }

  return (
    <div className="attach">
      <p className="small muted" id={`att-${questionId}`}>
        Opcional: adjuntar imagen si lo consideras necesario.
      </p>
      {has && preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Imagen que adjuntaste a esta respuesta" className="attach-img" />
      ) : null}
      {has && !preview ? <p className="small">Imagen adjunta.</p> : null}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onPick} aria-describedby={`att-${questionId}`} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn sm outline" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Procesando…' : has ? 'Cambiar imagen' : 'Adjuntar imagen'}
        </button>
        {has ? (
          <button type="button" className="btn sm outline" disabled={busy} onClick={remove}>
            Quitar imagen
          </button>
        ) : null}
      </div>
      {msg ? (
        <p role={msg.ok ? 'status' : 'alert'} className="small" style={{ color: msg.ok ? 'var(--verde-petroleo)' : 'var(--danger)', fontWeight: 700 }}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
