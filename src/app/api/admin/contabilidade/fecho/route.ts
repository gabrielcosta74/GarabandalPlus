import { logAdminAudit } from '../../../../../lib/admin-audit';
import { buildAccountantWorkbook } from '../../../../../lib/ledger/accountant-export';
import { currentLisbonPeriod, loadMonthData } from '../../../../../lib/ledger/month-close';
import { evaluateClose, readyToClose } from '../../../../../lib/ledger/month-close-rules';
import { db, isMissingTableError, requireAdmin } from '../../../../../lib/ledger/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const BUCKET = 'ledger-documents';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function state(period: string) {
  const [data, { data: row, error: rowError }, { data: history, error: historyError }] = await Promise.all([
    loadMonthData(period),
    db().from('ledger_periods').select('status, closed_by, closed_at, export_path').eq('period', period).maybeSingle(),
    db().from('ledger_period_events').select('action, actor, reason, created_at').eq('period', period).order('created_at', { ascending: false }).limit(20),
  ]);
  if (rowError) throw rowError;
  if (historyError && !isMissingTableError(historyError)) throw historyError;
  const checks = evaluateClose(data, currentLisbonPeriod());
  return { data, checks, closed: row?.status === 'closed' ? row : null, history: history || [] };
}

/** Read only: where the month stands, why it can or cannot close, and its history. */
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const period = new URL(req.url).searchParams.get('period') || '';
  if (!PERIOD.test(period)) return Response.json({ error: 'Mês inválido.' }, { status: 400 });
  try {
    const { checks, closed, history, data } = await state(period);
    return Response.json({ period, checks, ready: readyToClose(checks), closed, history, opening: data.opening, closing: data.closing },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível ler o mês.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.response;
  const body = await req.json().catch(() => null) as { period?: string; action?: string; reason?: string } | null;
  const period = body?.period || '';
  if (!PERIOD.test(period) || !['close', 'reopen'].includes(body?.action || '')) {
    return Response.json({ error: 'Pedido inválido.' }, { status: 400 });
  }

  try {
    if (body?.action === 'reopen') {
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
      const { error } = await db().rpc('ledger_reopen_period', { p_period: period, p_actor: admin.email, p_reason: reason });
      if (error) return Response.json({ error: error.message }, { status: error.code === 'P0001' ? 409 : 500 });
      await logAdminAudit({ adminEmail: admin.email, action: 'ledger.reopen_period', details: { period, reason } });
      return Response.json({ ok: true });
    }

    // Checked again here, whatever the page showed.
    const { data, checks, closed } = await state(period);
    if (closed) return Response.json({ error: 'Este mês já está fechado.' }, { status: 409 });
    if (!readyToClose(checks)) return Response.json({ error: 'Ainda há verificações por resolver.', checks }, { status: 409 });

    const generatedAt = new Date().toISOString();
    const workbook = await buildAccountantWorkbook(data, checks, { generatedAt, closedBy: admin.email, draft: false });
    const path = `exports/${period}/contabilidade-${period}-${generatedAt.replace(/[:.]/g, '-')}.xlsx`;
    const { error: uploadError } = await db().storage.from(BUCKET).upload(path, workbook, { contentType: XLSX, upsert: false });
    if (uploadError) throw uploadError;

    const { error } = await db().rpc('ledger_close_period', { p_period: period, p_actor: admin.email, p_checks: checks, p_export_path: path });
    if (error) {
      await db().storage.from(BUCKET).remove([path]);
      return Response.json({ error: error.message }, { status: error.code === 'P0001' ? 409 : 500 });
    }
    await logAdminAudit({ adminEmail: admin.email, action: 'ledger.close_period', details: { period, export_path: path } });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível fechar o mês.' }, { status: 500 });
  }
}
