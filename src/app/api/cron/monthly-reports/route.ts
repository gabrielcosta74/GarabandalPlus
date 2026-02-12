import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { buildStoreReportData, renderStoreReportCsv, renderStoreReportPdf } from '../../../../lib/reports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getPreviousMonth = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // previous month index
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return {
    year,
    month: month + 1,
    start,
    end,
  };
};

export async function GET(request: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase nao configurado' }, { status: 500 });
  }

  const secret = process.env.CRON_SECRET || '';
  if (!secret) {
    return NextResponse.json({ message: 'CRON_SECRET não configurado.' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { year, month, start, end } = getPreviousMonth();

  try {
    const data = await buildStoreReportData(supabaseServer, start, end);
    const totalOrders = data.paidOrders;
    const totalRevenue = data.totalRevenue;

    const pdfPath = `reports/${year}/${String(month).padStart(2, '0')}/relatorio-${year}-${String(month).padStart(2, '0')}.pdf`;
    const csvPath = `reports/${year}/${String(month).padStart(2, '0')}/relatorio-${year}-${String(month).padStart(2, '0')}.csv`;

    const pdfBytes = await renderStoreReportPdf(data);
    const csvBytes = Buffer.from(renderStoreReportCsv(data), 'utf8');

    await supabaseServer.storage
      .from('store-reports')
      .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });

    await supabaseServer.storage
      .from('store-reports')
      .upload(csvPath, csvBytes, { contentType: 'text/csv', upsert: true });

    await supabaseServer
      .from('store_reports')
      .upsert({
        kind: 'pdf',
        report_month: month,
        report_year: year,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        file_path: pdfPath,
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        currency: 'EUR',
        created_by: 'cron',
      }, { onConflict: 'kind,report_month,report_year' });

    await supabaseServer
      .from('store_reports')
      .upsert({
        kind: 'csv',
        report_month: month,
        report_year: year,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        file_path: csvPath,
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        currency: 'EUR',
        created_by: 'cron',
      }, { onConflict: 'kind,report_month,report_year' });

    return NextResponse.json({ ok: true, year, month });
  } catch (err) {
    console.error('Erro ao gerar relatorio mensal:', err);
    return NextResponse.json({ message: 'Erro ao gerar relatorio.' }, { status: 500 });
  }
}
