import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/server/adminAuth';
import { getStore } from '@/server/store';
import { getCandidateDetail, type PartReview, type QuestionReview } from '@/server/review';
import { STATUS_LABEL } from '@/server/status';
import { AdminNav } from '@/components/admin/AdminNav';
import { Blocks } from '@/components/Blocks';
import { CandidateActions } from '@/components/admin/CandidateActions';
import { EvalSelector } from '@/components/admin/EvalSelector';
import { NoteEditor } from '@/components/admin/NoteEditor';
import { Remaining } from '@/components/admin/Remaining';
import {
  DOUBTFUL_DATA,
  INTERVIEW_QUESTIONS,
  PART1_CRITERIA,
  PART3_INDICATORS,
  RUBRIC_NOTES,
  SIGNALS_DISCLAIMER,
  SKILLS,
  TEXT_FLAGS,
  type Criterion,
} from '@/content/rubric';
import { PART_ORDER, type PartId } from '@/content/types';

export const dynamic = 'force-dynamic';

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'medium' }) : '—';
const dur = (sec: number | null) => (sec == null ? '—' : `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, '0')} s`);

const CRITERIA_BY_Q: Record<string, Criterion | undefined> = {};
for (const part of ['1A', '1B'] as const) {
  PART1_CRITERIA[part].forEach((c, i) => {
    CRITERIA_BY_Q[`${part}:${part === '1A' ? i + 1 : i + 4}`] = c;
  });
}

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  const now = new Date();
  const d = await getCandidateDetail(await getStore(), id, now);
  if (!d) notFound();
  const inv = d.invitation;
  const part = (p: PartId) => d.parts.find((x) => x.id === p)!;
  const s = d.signals;

  return (
    <>
      <AdminNav email={admin} />
      <main className="wrap wide">
        <p>
          <Link href="/admin">← Todas las invitaciones</Link>
        </p>
        <p className="eyebrow">{inv.roleLabel}</p>
        <h1>
          {inv.name} <span className={`badge ${inv.status}`}>{STATUS_LABEL[inv.status]}</span>
        </h1>
        <p className="muted">
          {inv.email} · Variante: {d.variant.name}
        </p>
        <span className="rail" aria-hidden="true" />

        <div className="grid-2">
          <section className="card">
            <h2>Tiempos</h2>
            <table>
              <tbody>
                <tr><th scope="row">Invitación creada</th><td>{fmt(inv.createdAt)}</td></tr>
                <tr><th scope="row">Enlace vence (si no inicia)</th><td>{fmt(inv.expiresAt)}</td></tr>
                <tr><th scope="row">Inició</th><td>{fmt(inv.startedAt)}</td></tr>
                <tr><th scope="row">Límite (90 min)</th><td>{fmt(inv.deadlineAt)}</td></tr>
                <tr><th scope="row">Terminó</th><td>{inv.finishedAt ? `${fmt(inv.finishedAt)} (envió todo)` : inv.status === 'expirada' ? 'Se cerró por tiempo con lo guardado' : '—'}</td></tr>
                {inv.remainingMs !== null && inv.deadlineAt ? (
                  <tr><th scope="row">Tiempo restante</th><td><Remaining deadlineAt={inv.deadlineAt} serverNow={now.toISOString()} /></td></tr>
                ) : null}
                <tr><th scope="row">Reinicios de reloj</th><td>{inv.clockResets}</td></tr>
              </tbody>
            </table>
            <p />
            <CandidateActions id={inv.id} canReset={inv.status === 'en_curso' || inv.status === 'expirada'} canRegenerate={inv.status === 'creada' || inv.status === 'vencida'} />
          </section>

          <section className="card warn" aria-labelledby="senales">
            <h2 id="senales">Señales registradas</h2>
            <p><strong>{SIGNALS_DISCLAIMER}</strong></p>
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Señales por parte">
              <table>
                <thead>
                  <tr><th>Parte</th><th className="num">Tiempo</th><th className="num">Pegados</th><th className="num">Car. pegados</th><th className="num">Salidas de pestaña</th><th className="num">Tiempo fuera</th><th className="num">Ráfagas</th></tr>
                </thead>
                <tbody>
                  {PART_ORDER.map((p) => (
                    <tr key={p}>
                      <td>{p}</td>
                      <td className="num">{dur(part(p).durationSec)}</td>
                      <td className="num">{s.perPart[p].pasteCount}</td>
                      <td className="num">{s.perPart[p].pasteChars}</td>
                      <td className="num">{s.perPart[p].blurCount}</td>
                      <td className="num">{Math.round(s.perPart[p].blurMs / 1000)} s</td>
                      <td className="num">{s.perPart[p].bursts}</td>
                    </tr>
                  ))}
                  <tr>
                    <th>Total</th><td />
                    <th className="num">{s.total.pasteCount}</th>
                    <th className="num">{s.total.pasteChars}</th>
                    <th className="num">{s.total.blurCount}</th>
                    <th className="num">{Math.round(s.total.blurMs / 1000)} s</th>
                    <th className="num">{s.total.bursts}</th>
                  </tr>
                </tbody>
              </table>
            </div>
            {s.bursts.length ? (
              <>
                <h3>Ráfagas de texto</h3>
                <ul className="small">
                  {s.bursts.map((b, i) => (
                    <li key={i}>
                      Parte {b.part}, campo {b.questionId}: +{b.deltaChars} caracteres en ~{b.seconds} s ({fmt(b.at)}).
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className="small muted">
              Ráfaga = texto que crece demasiado rápido entre dos autoguardados para haberse escrito a mano (heurística). Un pegado puede tener explicaciones legítimas (p. ej. reescribir desde sus propios apuntes). No hay cámara, micrófono, grabación de pantalla ni huella del dispositivo.
            </p>
          </section>
        </div>

        {/* ───────── Evaluación por habilidad ───────── */}
        <section className="card" aria-labelledby="habilidades">
          <h2 id="habilidades">Estado por habilidad</h2>
          <p className="muted small">Evidencia observada en esta prueba. No se calcula ni se muestra un puntaje total.</p>
          {SKILLS.map((sk) => (
            <div className="eval-row" key={sk.code}>
              <div>
                <strong>{sk.code} · {sk.name}</strong>
                <br />
                <span className="small muted">{sk.source}</span>
              </div>
              {sk.evidenced ? (
                <EvalSelector invitationId={inv.id} evalKey={sk.code} label={sk.name} initial={d.evaluations[sk.code] ?? null} />
              ) : (
                <span className="pill warn">No evidenciada: validar en entrevista</span>
              )}
            </div>
          ))}
          <ul className="small muted">
            {RUBRIC_NOTES.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </section>

        {/* ───────── Parte 1 ───────── */}
        <details className="card case">
          <summary>Caso de la Parte 1: {d.variant.caseTitle} (enunciado completo y giro)</summary>
          <Blocks blocks={d.variant.caseContext} />
          <h4 style={{ marginTop: 24 }}>Giro (se reveló al enviar 1A)</h4>
          <Blocks blocks={d.variant.twist} />
        </details>

        {(['1A', '1B'] as const).map((pid) => (
          <PartSection key={pid} p={part(pid)} d={d}>
            {part(pid).questions.map((q) => (
              <OpenPair key={q.id} q={q} partId={pid} signals={s} criterion={CRITERIA_BY_Q[`${pid}:${q.number}`]} />
            ))}
            {pid === '1A' ? (
              <div className="card subtle">
                <h3>Datos dudosos esperados (solo referencia: lecturas posibles, no respuestas únicas)</h3>
                <ul>{DOUBTFUL_DATA[inv.role].map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            ) : null}
            <NoteEditor invitationId={inv.id} part={pid} initial={d.notes[pid] ?? ''} />
          </PartSection>
        ))}

        {/* ───────── Parte 2 ───────── */}
        <PartSection p={part('2')} d={d}>
          <p className="muted small">Sin puntaje de corte. Esta parte pesa menos que las Partes 1 y 3. La clave solo se ve aquí.</p>
          <h3>Aciertos por habilidad</h3>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Aciertos por habilidad">
            <table>
              <thead><tr><th>Habilidad</th><th className="num">Aciertos</th></tr></thead>
              <tbody>
                {d.part2BySkill.map((x) => (
                  <tr key={x.skill}>
                    <td>{x.skill} · {SKILLS.find((k) => k.code === x.skill)?.name}</td>
                    <td className="num">{x.correct} de {x.total} ítems</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 style={{ marginTop: 24 }}>Por ítem</h3>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Respuestas por ítem">
            <table>
              <thead><tr><th className="num">#</th><th>Enunciado</th><th>Eligió</th><th>Clave</th><th>Resultado</th></tr></thead>
              <tbody>
                {part('2').questions.map((q) => (
                  <tr key={q.id}>
                    <td className="num">{q.number}</td>
                    <td>{q.prompt}</td>
                    <td>{q.mc?.selectedText ?? <em className="muted">Sin responder</em>}</td>
                    <td>{q.mc?.correctText}<br /><span className="small muted">Habilidad {q.mc?.skills.join(' y ')}</span></td>
                    <td>{q.mc?.correct === null ? <span className="muted">—</span> : q.mc?.correct ? <span className="mc-ok">✓ Acierto</span> : <span className="mc-bad">✗ Error</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NoteEditor invitationId={inv.id} part="2" initial={d.notes['2'] ?? ''} />
        </PartSection>

        {/* ───────── Parte 3 ───────── */}
        <PartSection p={part('3')} d={d}>
          {part('3').questions.map((q) => (
            <OpenPair key={q.id} q={q} partId="3" signals={s} groupLimit={part('3').groupWordLimit} />
          ))}
          <p className="small muted">
            Palabras totales: {part('3').questions.reduce((a, q) => a + q.words, 0)} / {part('3').groupWordLimit}
          </p>
          <h3>Indicadores de la Parte 3</h3>
          {PART3_INDICATORS.map((i) => (
            <div className="eval-row" key={i.key}>
              <div>
                <strong>{i.title}</strong>
                <div className="small muted">
                  Sólida: {i.solida} · Indicio: {i.indicio} · Sin evidencia: {i.sin}
                </div>
                {i.note ? <div className="small">{i.note}</div> : null}
              </div>
              <EvalSelector invitationId={inv.id} evalKey={i.key} label={i.title} initial={d.evaluations[i.key] ?? null} />
            </div>
          ))}
          <NoteEditor invitationId={inv.id} part="3" initial={d.notes['3'] ?? ''} />
        </PartSection>

        {/* ───────── Entrevista de defensa ───────── */}
        <section className="grid-2">
          <div className="card">
            <h2>Banderas de texto sin criterio propio</h2>
            <p className="small muted">Son señales, no pruebas.</p>
            <ul>{TEXT_FLAGS.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
          <div className="card">
            <h2>Preguntas modelo para la entrevista de defensa</h2>
            <ol>{INTERVIEW_QUESTIONS.map((q) => <li key={q}>{q}</li>)}</ol>
          </div>
        </section>

        {d.audit.length ? (
          <section className="card" aria-labelledby="auditoria">
            <h2 id="auditoria">Registro de auditoría (inmutable)</h2>
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Registro de auditoría">
              <table>
                <thead><tr><th>Cuándo</th><th>Quién</th><th>Acción</th><th>Motivo / detalle</th></tr></thead>
                <tbody>
                  {d.audit.map((a, i) => (
                    <tr key={i}>
                      <td>{fmt(a.at)}</td>
                      <td>{a.actor}</td>
                      <td>{a.action}</td>
                      <td>
                        {a.reason ? <div>{a.reason}</div> : null}
                        <div className="small muted">{Object.entries(a.details).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}

function PartSection({ p, d, children }: { p: PartReview; d: { invitation: { status: string } }; children: React.ReactNode }) {
  return (
    <section className="card" aria-labelledby={`part-${p.id}`}>
      <h2 id={`part-${p.id}`}>
        {p.title}{' '}
        {p.submitted ? <span className="badge enviada">Enviada {p.submittedAt ? new Date(p.submittedAt).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' }) : ''}</span> : <span className="badge creada">{d.invitation.status === 'expirada' ? 'Sin enviar (cierre por tiempo)' : 'No enviada'}</span>}
      </h2>
      <p className="small muted">
        Tiempo en la parte: {dur(p.durationSec)} · sugerido {p.suggestedMinutes} min
      </p>
      {children}
    </section>
  );
}

function OpenPair({
  q,
  partId,
  signals,
  criterion,
  groupLimit,
}: {
  q: QuestionReview;
  partId: PartId;
  signals: import('@/lib/signals').SignalSummary;
  criterion?: Criterion;
  groupLimit?: number | null;
}) {
  const sig = signals.perQuestion[q.id];
  const tl = signals.timeline[q.id] ?? [];
  let maxJump = 0;
  tl.forEach((t, i) => (maxJump = Math.max(maxJump, t.chars - (tl[i - 1]?.chars ?? 0))));
  return (
    <div className="review-pair">
      <div>
        <p><strong><span className="q-num">{q.number}.</span>{q.prompt}</strong></p>
        {criterion ? (
          <div className="card subtle small">
            <strong>Criterio: {criterion.title}</strong> <span className="muted">(habilidades {criterion.skills})</span>
            <ul>
              <li><strong>Operativo:</strong> {criterion.operativo}</li>
              <li><strong>Avanzado:</strong> {criterion.avanzado}</li>
              <li><strong>Alertas:</strong> {criterion.alertas}</li>
            </ul>
          </div>
        ) : null}
      </div>
      <div>
        <div className={'answer-box' + (q.text ? '' : ' empty')}>{q.text || 'Sin respuesta'}</div>
        <p className="small muted" style={{ marginTop: 8 }}>
          <span className="pill">{q.words}{q.wordLimit ? ` / ${q.wordLimit}` : groupLimit ? ` (límite total ${groupLimit})` : ''} palabras</span>
          {sig ? <span className="pill warn">Pegados: {sig.pasteCount} ({sig.pasteChars} car.)</span> : null}
          {tl.length ? <span className="pill">Autoguardados: {tl.length} · mayor salto +{maxJump} car.</span> : null}
          <span className="sr-only">Parte {partId}</span>
        </p>
      </div>
    </div>
  );
}
