import Link from 'next/link';
import { requireAdminPage } from '@/server/adminAuth';
import { getStore } from '@/server/store';
import { listInvitations, type ListRow } from '@/server/review';
import { STATUS_LABEL } from '@/server/status';
import { config } from '@/server/config';
import { AdminNav } from '@/components/admin/AdminNav';
import { CreateInvitation } from '@/components/admin/CreateInvitation';
import { Remaining } from '@/components/admin/Remaining';

export const dynamic = 'force-dynamic';

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }) : '—';

/** ¿La persona ya accedió? Tres situaciones claras, de menos a más avance. */
function access(r: ListRow): { label: string; detail: string; tone: 'none' | 'opened' | 'started' } {
  if (r.startedAt) return { label: 'Inició la prueba', detail: fmt(r.startedAt), tone: 'started' };
  if (r.openedAt) return { label: 'Abrió el enlace', detail: `${fmt(r.openedAt)} · aún no empieza`, tone: 'opened' };
  return { label: r.status === 'vencida' ? 'Nunca abrió el enlace' : 'Aún no abre el enlace', detail: '', tone: 'none' };
}

export default async function AdminHome() {
  const admin = await requireAdminPage();
  const now = new Date();
  const rows = await listInvitations(await getStore(), now);
  const c = config();
  const pending: string[] = [];
  if (!c.privacyPolicyUrl) pending.push('PRIVACY_POLICY_URL (enlace a la política de datos personales de Háptica en la pantalla de inicio)');
  if (c.dataRetentionDays === null) pending.push('DATA_RETENTION_DAYS (retención de datos: definirla con Jurídico antes de usar la plataforma con candidatos reales)');

  const count = {
    sinAbrir: rows.filter((r) => !r.openedAt && !r.startedAt && r.status !== 'vencida').length,
    abrieron: rows.filter((r) => r.openedAt && !r.startedAt && r.status !== 'vencida').length,
    enCurso: rows.filter((r) => r.status === 'en_curso').length,
    terminaron: rows.filter((r) => r.status === 'enviada' || r.status === 'expirada').length,
    vencidas: rows.filter((r) => r.status === 'vencida').length,
  };

  return (
    <>
      <AdminNav email={admin} />
      <main className="wrap wide">
        <p className="eyebrow">Panel del equipo</p>
        <h1>Invitaciones y candidatos</h1>
        <span className="rail" aria-hidden="true" />

        {pending.length ? (
          <div className="card warn" role="note">
            <strong>Configuración pendiente antes de usar con candidatos reales:</strong>
            <ul>
              {pending.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <CreateInvitation />

        <section aria-labelledby="lista">
          <h2 id="lista">Todas las invitaciones ({rows.length})</h2>
          {rows.length ? (
            <p className="small muted">
              Sin abrir el enlace: <strong>{count.sinAbrir}</strong> · Abrieron el enlace sin empezar: <strong>{count.abrieron}</strong> · En curso: <strong>{count.enCurso}</strong> · Terminaron:{' '}
              <strong>{count.terminaron}</strong> · Enlace vencido sin iniciar: <strong>{count.vencidas}</strong>
            </p>
          ) : null}
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Lista de invitaciones">
            <table>
              <thead>
                <tr>
                  <th>Candidato</th>
                  <th>Rol</th>
                  <th>Invitación creada</th>
                  <th>¿Accedió?</th>
                  <th>Estado de la prueba</th>
                  <th>Parte actual</th>
                  <th>Tiempo restante</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted">
                      Aún no hay invitaciones. Crea la primera arriba.
                    </td>
                  </tr>
                ) : null}
                {rows.map((r) => {
                  const a = access(r);
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                        <br />
                        <span className="small muted">{r.email}</span>
                      </td>
                      <td>{r.roleLabel}</td>
                      <td>
                        {fmt(r.createdAt)}
                        {!r.startedAt ? (
                          <>
                            <br />
                            <span className="small muted">{r.status === 'vencida' ? 'Enlace vencido' : `Enlace vence ${fmt(r.expiresAt)}`}</span>
                          </>
                        ) : null}
                      </td>
                      <td>
                        <span className={`pill${a.tone === 'none' ? ' warn' : ''}`}>{a.label}</span>
                        {a.detail ? (
                          <>
                            <br />
                            <span className="small muted">{a.detail}</span>
                          </>
                        ) : null}
                      </td>
                      <td>
                        <span className={`badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                        {r.clockResets ? <span className="small muted"> · reloj reiniciado {r.clockResets}×</span> : null}
                      </td>
                      <td>{r.currentPart ?? '—'}</td>
                      <td>{r.status === 'en_curso' && r.deadlineAt ? <Remaining deadlineAt={r.deadlineAt} serverNow={now.toISOString()} /> : '—'}</td>
                      <td>
                        <Link className="btn sm outline" href={`/admin/c/${r.id}`}>
                          Ver
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
