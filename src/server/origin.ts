/**
 * Defensa CSRF para formularios y mutaciones del panel: solo se aceptan peticiones del mismo origen.
 *
 * - Los navegadores modernos envían `Sec-Fetch-Site` (same-origin | same-site | cross-site | none): es lo más fiable.
 * - Con `Referrer-Policy: no-referrer` un formulario del mismo sitio llega con `Origin: null`; por eso ese valor
 *   NUNCA se interpreta como URL y, si no hay `Sec-Fetch-Site`, se rechaza por prudencia.
 * - Sin ninguno de los dos encabezados (herramientas como curl) no es una petición de navegador: se permite,
 *   porque la cookie de sesión es SameSite=Lax y no la adjunta un sitio ajeno.
 */
export function isSameOrigin(headers: { get(name: string): string | null }): boolean {
  const site = headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';
  const origin = headers.get('origin');
  if (origin === null) return true;
  if (origin === 'null' || origin === '') return false;
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}
