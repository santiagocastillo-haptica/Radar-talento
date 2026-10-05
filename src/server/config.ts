/** Configuración leída del entorno en cada uso (permite cambiarla en pruebas). */
function num(v: string | undefined, def: number): number {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : def;
}

export function config() {
  const e = process.env;
  return {
    durationMinutes: num(e.TEST_DURATION_MINUTES, 90),
    inviteValidHours: num(e.INVITE_VALID_HOURS, 24),
    graceSeconds: num(e.WRITE_GRACE_SECONDS, 10),
    appUrl: (e.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
    privacyPolicyUrl: e.PRIVACY_POLICY_URL || '',
    /** Vacío por defecto: debe definirse con Jurídico antes de usar con candidatos reales. */
    dataRetentionDays: e.DATA_RETENTION_DAYS ? Number(e.DATA_RETENTION_DAYS) : null,
    adminDomain: (e.ADMIN_ALLOWED_DOMAIN || 'haptica.co').toLowerCase(),
    adminEmails: (e.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    isProd: e.NODE_ENV === 'production',
  };
}

export function requireSecret(name: 'SESSION_SECRET' | 'TOKEN_HASH_SECRET' | 'CRON_SECRET'): string {
  const v = process.env[name];
  if (v) return v;
  if (config().isProd) throw new Error(`Falta la variable de entorno ${name}`);
  return `dev-only-${name.toLowerCase()}-no-usar-en-produccion`;
}
