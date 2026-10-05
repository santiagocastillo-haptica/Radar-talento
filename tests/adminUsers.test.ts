import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@/server/store';
import { AppError } from '@/server/attempt';
import {
  authenticate,
  changeOwnPassword,
  createAdminUser,
  generatePassword,
  getAdminUser,
  hashPassword,
  listAdminUsers,
  resetPassword,
  setActive,
  validatePassword,
  verifyPassword,
} from '@/server/adminUsers';

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof AppError ? e.code : `otro: ${(e as Error).message}`;
  }
  return 'no_error';
};

const GOOD = 'una-clave-larga-y-buena-2026';
const T = new Date('2026-10-05T14:00:00Z');

describe('contraseñas', () => {
  it('scrypt con sal: mismo texto, hashes distintos, y verifica solo la contraseña correcta', async () => {
    const a = await hashPassword(GOOD);
    const b = await hashPassword(GOOD);
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(a).not.toContain(GOOD);
    expect(await verifyPassword(GOOD, a)).toBe(true);
    expect(await verifyPassword(GOOD + 'x', a)).toBe(false);
    expect(await verifyPassword(GOOD, 'basura')).toBe(false);
  });

  it('política mínima', () => {
    expect(validatePassword('corta', 'a@b.co')).toMatch(/12 caracteres/);
    expect(validatePassword('aaaaaaaaaaaaaaaa', 'a@b.co')).toMatch(/repetitiva/);
    expect(validatePassword('ana.perez@haptica.co', 'ana.perez@haptica.co')).toMatch(/igual al correo/);
    expect(validatePassword(GOOD, 'a@b.co')).toBeNull();
    expect(generatePassword().length).toBeGreaterThanOrEqual(20);
    expect(generatePassword()).not.toBe(generatePassword());
  });
});

describe('usuarios y acceso', () => {
  async function store() {
    const s = new MemoryStore();
    const { temporaryPassword } = await createAdminUser(s, { email: 'Ana@Haptica.co', name: 'Ana', actor: 'test' }, T);
    return { s, temp: temporaryPassword! };
  }

  it('crea con contraseña temporal que obliga a cambiarla; no se duplica ni filtra el hash', async () => {
    const { s, temp } = await store();
    const u = (await getAdminUser(s, 'ana@haptica.co'))!;
    expect(u.mustChange).toBe(true);
    expect(u.active).toBe(true);
    expect(await code(createAdminUser(s, { email: 'ana@haptica.co', actor: 'x' }))).toBe('user_exists');
    expect(await code(createAdminUser(s, { email: 'no-es-correo', actor: 'x' }))).toBe('bad_email');
    expect(await code(createAdminUser(s, { email: 'b@haptica.co', password: 'corta', actor: 'x' }))).toBe('weak_password');
    expect(JSON.stringify(await listAdminUsers(s))).not.toMatch(/passwordHash|scrypt/);
    // Ni el hash ni la contraseña temporal quedan en la auditoría.
    const audit = JSON.stringify(await s.query('auditLog'));
    expect(audit).not.toContain(temp);
    expect(audit).not.toMatch(/scrypt|passwordHash/);
    expect(audit).toContain('admin_user_created');
  });

  it('inicia sesión con correo (sin distinguir mayúsculas) y falla con mensaje genérico', async () => {
    const { s, temp } = await store();
    const ok = await authenticate(s, 'ANA@haptica.co', temp, '1.1.1.1', T);
    expect(ok.email).toBe('ana@haptica.co');
    expect(ok.mustChange).toBe(true);
    expect(await code(authenticate(s, 'ana@haptica.co', 'incorrecta', '1.1.1.1', T))).toBe('bad_credentials');
    expect(await code(authenticate(s, 'nadie@haptica.co', temp, '1.1.1.1', T))).toBe('bad_credentials'); // mismo error si no existe
  });

  it('bloquea temporalmente tras 5 fallos por correo (aunque cambie la IP) y se libera con el tiempo', async () => {
    const { s, temp } = await store();
    for (let i = 0; i < 5; i++) expect(await code(authenticate(s, 'ana@haptica.co', 'mal-' + i, `9.9.9.${i}`, T))).toBe('bad_credentials');
    expect(await code(authenticate(s, 'ana@haptica.co', temp, '8.8.8.8', T))).toBe('rate_limited'); // ni la correcta pasa
    const later = new Date(T.getTime() + 16 * 60_000);
    expect((await authenticate(s, 'ana@haptica.co', temp, '8.8.8.8', later)).email).toBe('ana@haptica.co');
  });

  it('cambiar la contraseña quita la marca temporal e invalida sesiones anteriores', async () => {
    const { s, temp } = await store();
    const before = await authenticate(s, 'ana@haptica.co', temp, '1.1.1.1', T);
    expect(await code(changeOwnPassword(s, 'ana@haptica.co', 'incorrecta', GOOD))).toBe('bad_credentials');
    expect(await code(changeOwnPassword(s, 'ana@haptica.co', temp, 'corta'))).toBe('weak_password');
    expect(await code(changeOwnPassword(s, 'ana@haptica.co', temp, temp))).toBe('same_password');
    const after = await changeOwnPassword(s, 'ana@haptica.co', temp, GOOD, T);
    expect(after.mustChange).toBe(false);
    expect(after.tokenVersion).toBeGreaterThan(before.tokenVersion);
    expect(await code(authenticate(s, 'ana@haptica.co', temp, '2.2.2.2', T))).toBe('bad_credentials');
    expect((await authenticate(s, 'ana@haptica.co', GOOD, '2.2.2.2', T)).mustChange).toBe(false);
  });

  it('restablecer genera otra temporal, la marca como pendiente y sube la versión de sesión', async () => {
    const { s, temp } = await store();
    const v0 = (await getAdminUser(s, 'ana@haptica.co'))!.tokenVersion;
    const next = await resetPassword(s, 'ana@haptica.co', 'admin@haptica.co', T);
    expect(next).not.toBe(temp);
    const u = (await getAdminUser(s, 'ana@haptica.co'))!;
    expect(u.mustChange).toBe(true);
    expect(u.tokenVersion).toBe(v0 + 1);
    expect(await code(authenticate(s, 'ana@haptica.co', temp, '3.3.3.3', T))).toBe('bad_credentials');
    expect((await authenticate(s, 'ana@haptica.co', next, '3.3.3.3', T)).email).toBe('ana@haptica.co');
    expect(await code(resetPassword(s, 'nadie@haptica.co', 'admin@haptica.co'))).toBe('not_found');
  });

  it('desactivar impide entrar; no se puede desactivar al último administrador activo', async () => {
    const { s } = await store();
    expect(await code(setActive(s, 'ana@haptica.co', false, 'ana@haptica.co'))).toBe('last_admin');
    const { temporaryPassword } = await createAdminUser(s, { email: 'luis@haptica.co', actor: 'ana' }, T);
    await setActive(s, 'luis@haptica.co', false, 'ana@haptica.co', T);
    expect(await code(authenticate(s, 'luis@haptica.co', temporaryPassword!, '4.4.4.4', T))).toBe('bad_credentials');
    await setActive(s, 'luis@haptica.co', true, 'ana@haptica.co', T);
    expect((await authenticate(s, 'luis@haptica.co', temporaryPassword!, '4.4.4.4', T)).email).toBe('luis@haptica.co');
  });
});

describe('contraseña copiada con espacios', () => {
  it('acepta espacios o saltos de línea sobrantes en los extremos al iniciar sesión', async () => {
    const s = new MemoryStore();
    const { temporaryPassword } = await createAdminUser(s, { email: 'ana@haptica.co', actor: 't' }, T);
    for (const variant of [temporaryPassword + ' ', '  ' + temporaryPassword, temporaryPassword + '\r\n', temporaryPassword]) {
      expect((await authenticate(s, 'ana@haptica.co', variant, '5.5.5.5', T)).email).toBe('ana@haptica.co');
    }
    expect(await code(authenticate(s, 'ana@haptica.co', temporaryPassword + 'x', '5.5.5.5', T))).toBe('bad_credentials');
  });
});
