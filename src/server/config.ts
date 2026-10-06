/** Configuración leída del entorno en cada uso (permite cambiarla en pruebas). */
function num(v: string | undefined, def: number): number {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : def;
}

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
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
    /**
     * Cierre de la prueba (TEST_CLOSES_AT, ISO-8601 con zona, p. ej. 2026-10-08T13:00:00-05:00): pasada esa hora nadie
     * puede INICIAR la prueba. Quien ya empezó conserva su ventana de 90 min. Vacío o inválido = sin cierre.
     */
    testClosesAt: parseDate(e.TEST_CLOSES_AT),
    isProd: e.NODE_ENV === 'production',
  };
}

export function requireSecret(name: 'SESSION_SECRET' | 'TOKEN_HASH_SECRET' | 'CRON_SECRET'): string {
  const v = process.env[name];
  if (v) return v;
  if (config().isProd) throw new Error(`Falta la variable de entorno ${name}`);
  return `dev-only-${name.toLowerCase()}-no-usar-en-produccion`;
}
