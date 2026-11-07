import { buildAccountantWorkbook } from '../../../../../../lib/ledger/accountant-export';
import { currentLisbonPeriod, loadMonthData } from '../../../../../../lib/ledger/month-close';
import { evaluateClose } from '../../../../../../lib/ledger/month-close-rules';
import { db, requireAdmin } from '../../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * A closed month returns the workbook saved when it closed, exactly as sent.
 * An open month returns a draft built now, marked as such inside the file.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const period = new URL(req.url).searchParams.get('period') || '';
  if (!PERIOD.test(period)) return Response.json({ error: 'Mês inválido.' }, { status: 400 });

  try {
    const { data: row, error } = await db().from('ledger_periods').select('status, export_path').eq('period', period).maybeSingle();
    if (error) throw error;
    let bytes: Uint8Array;
    let draft = false;
    if (row?.status === 'closed' && row.export_path) {
      const { data: file, error: downloadError } = await db().storage.from('ledger-documents').download(row.export_path);
      if (downloadError || !file) throw downloadError || new Error('O ficheiro do fecho não foi encontrado.');
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      const data = await loadMonthData(period);
      bytes = await buildAccountantWorkbook(data, evaluateClose(data, currentLisbonPeriod()), { generatedAt: new Date().toISOString(), draft: true });
      draft = true;
    }
    const name = `contabilidade-${period}${draft ? '-rascunho' : ''}.xlsx`;
    return new Response(bytes as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível gerar o Excel.' }, { status: 500 });
  }
}
