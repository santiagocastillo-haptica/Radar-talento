/** ¿Puede esta cuenta entrar al panel? Dominio exacto de Háptica y, si se define, lista blanca de correos. */
export function adminEmailAllowed(email: string | null | undefined, domain: string, allowlist: string[]): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return false;
  if (e.slice(at + 1) !== domain.toLowerCase()) return false;
  if (allowlist.length && !allowlist.includes(e)) return false;
  return true;
}
