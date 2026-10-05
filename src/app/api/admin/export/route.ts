import { adminRoute } from '@/server/http';
import { buildExport, toCsv, toXlsx } from '@/server/export';

export const dynamic = 'force-dynamic';

/** GET /api/admin/export?format=xlsx|csv[&hoja=candidatos|respuestas] */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
  const hoja = url.searchParams.get('hoja') === 'respuestas' ? 'respuestas' : 'candidatos';
  return adminRoute(req, async (db) => {
    const { candidatos, respuestas } = await buildExport(db);
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      const sheet = hoja === 'respuestas' ? respuestas : candidatos;
      return new Response(toCsv(sheet), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="haptica-${hoja}-${stamp}.csv"`,
        },
      });
    }
    const buf = await toXlsx([candidatos, respuestas]);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="haptica-seleccion-${stamp}.xlsx"`,
      },
    });
  });
}
