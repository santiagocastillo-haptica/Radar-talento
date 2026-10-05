/** Cuenta palabras como secuencias separadas por espacios. Misma función en cliente y servidor. */
export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/u).length;
}
