export async function adminFetch<T = any>(method: string, url: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: json };
    if (res.status === 401) return { ok: false, message: 'Tu sesión expiró. Recarga la página para volver a entrar.' };
    return { ok: false, message: json?.error?.message ?? 'No se pudo completar la acción' };
  } catch {
    return { ok: false, message: 'Sin conexión' };
  }
}
