import crypto from 'node:crypto';
import { requireSecret } from './config';

/** Token largo e impredecible (256 bits). Solo se guarda su HMAC; el token nunca se persiste ni se registra. */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHmac('sha256', requireSecret('TOKEN_HASH_SECRET')).update(token).digest('hex');
}

/** Comparación en tiempo constante de dos hashes hex. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
