import ExcelJS from 'exceljs';
import type { Store } from './store';
import { getCandidateDetail, listInvitations, type CandidateDetail } from './review';
import { EVAL_STATUS_LABEL, PART3_INDICATORS, SKILLS } from '@/content/rubric';
import { STATUS_LABEL } from './status';
import { PART_ORDER } from '@/content/types';

/** Exportación: una fila por candidato (sin puntaje total) y una hoja con las respuestas abiertas. */

/** Ítems de la Parte 2 por candidato (8 comunes + 2 del rol). */
const PART2_ITEMS = 10;

type Cell = string | number | null;
export interface Sheet {
  name: string;
  headers: string[];
  rows: Cell[][];
}

const iso = (s: string | null) => (s ? s.replace('T', ' ').slice(0, 19) + ' UTC' : '');
const minutes = (sec: number | null) => (sec == null ? '' : Math.round((sec / 60) * 10) / 10);

function candidateRow(d: CandidateDetail): Cell[] {
  const inv = d.invitation;
  const row: Cell[] = [
    inv.name,
    inv.email,
    inv.roleLabel,
    d.variant.name,
    STATUS_LABEL[inv.status],
    iso(inv.createdAt),
    iso(inv.openedAt),
    iso(inv.startedAt),
    iso(inv.finishedAt ?? (inv.status === 'expirada' ? inv.deadlineAt : null)),
    inv.clockResets,
  ];
  for (const s of SKILLS) {
    row.push(s.evidenced ? (d.evaluations[s.code] ? EVAL_STATUS_LABEL[d.evaluations[s.code]] : '') : 'Validar en entrevista');
  }
  for (const i of PART3_INDICATORS) row.push(d.evaluations[i.key] ? EVAL_STATUS_LABEL[d.evaluations[i.key]] : '');
  const p2 = d.parts.find((p) => p.id === '2')!;
  for (let n = 1; n <= PART2_ITEMS; n++) {
    const q = p2.questions.find((x) => x.number === n);
    row.push(q?.mc ? (q.mc.correct === null ? '' : q.mc.correct ? 1 : 0) : '');
  }
  for (const id of PART_ORDER) row.push(minutes(d.parts.find((p) => p.id === id)?.durationSec ?? null));
  const t = d.signals.total;
  row.push(t.pasteCount, t.pasteChars, t.blurCount, Math.round(t.blurMs / 1000), t.bursts);
  for (const id of PART_ORDER) row.push(d.notes[id] ?? '');
  return row;
}

const CANDIDATE_HEADERS = [
  'Nombre',
  'Correo',
  'Rol',
  'Variante',
  'Estado',
  'Creada',
  'Abrió el enlace',
  'Inició',
  'Cerró',
  'Reinicios de reloj',
  ...SKILLS.map((s) => `Habilidad ${s.code} ${s.name}`),
  ...PART3_INDICATORS.map((i) => `Parte 3: ${i.title}`),
  ...Array.from({ length: PART2_ITEMS }, (_, i) => `P2 ítem ${i + 1} (1=acierto, 0=error)`),
  ...PART_ORDER.map((p) => `Minutos en ${p}`),
  'Eventos de pegado',
  'Caracteres pegados',
  'Salidas de pestaña',
  'Segundos fuera de la pestaña',
  'Ráfagas de texto',
  ...PART_ORDER.map((p) => `Notas ${p}`),
];

export async function buildExport(db: Store, now = new Date()): Promise<{ candidatos: Sheet; respuestas: Sheet }> {
  const list = await listInvitations(db, now);
  const details: CandidateDetail[] = [];
  for (const l of list) {
    const d = await getCandidateDetail(db, l.id, now);
    if (d) details.push(d);
  }
  const candidatos: Sheet = { name: 'Candidatos', headers: CANDIDATE_HEADERS, rows: details.map(candidateRow) };

  const rows: Cell[][] = [];
  for (const d of details) {
    for (const p of d.parts) {
      for (const q of p.questions) {
        if (q.kind !== 'open') continue;
        const sig = d.signals.perQuestion[q.id];
        rows.push([
          d.invitation.name,
          d.invitation.email,
          d.invitation.roleLabel,
          p.id,
          q.number,
          q.label ?? '',
          q.prompt,
          q.text ?? '',
          q.words,
          q.wordLimit ?? p.groupWordLimit ?? '',
          sig?.pasteCount ?? 0,
          sig?.pasteChars ?? 0,
          q.image ? 'Sí' : '',
        ]);
      }
    }
  }
  const respuestas: Sheet = {
    name: 'Respuestas abiertas',
    headers: ['Nombre', 'Correo', 'Rol', 'Parte', 'N.º', 'Campo', 'Enunciado', 'Respuesta', 'Palabras', 'Límite de palabras', 'Pegados en el campo', 'Caracteres pegados', 'Imagen adjunta'],
    rows,
  };
  return { candidatos, respuestas };
}

export async function toXlsx(sheets: Sheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Háptica · Radar Talento';
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow(s.headers);
    for (const r of s.rows) ws.addRow(r.map((c) => (typeof c === 'string' ? c.slice(0, 32000) : c)));
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003237' } };
    header.alignment = { vertical: 'middle', wrapText: true };
    header.height = 42;
    ws.columns.forEach((col, i) => {
      const longest = Math.max(s.headers[i]?.length ?? 8, ...s.rows.slice(0, 200).map((r) => String(r[i] ?? '').length));
      col.width = Math.min(60, Math.max(10, longest * 0.9));
    });
    ws.eachRow((row, n) => {
      if (n > 1) row.alignment = { vertical: 'top', wrapText: true };
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** CSV con BOM (Excel en español lo abre bien) y neutralización de inyección de fórmulas. */
export function toCsv(sheet: Sheet): string {
  const esc = (c: Cell) => {
    let s = c == null ? '' : String(c);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return '﻿' + [sheet.headers, ...sheet.rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}
