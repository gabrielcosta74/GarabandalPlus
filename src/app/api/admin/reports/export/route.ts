import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../lib/supabase';
import { buildStoreReportData, renderStoreReportCsv, renderStoreReportPdf } from '../../../../../lib/reports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  kind: z.enum(['pdf', 'csv']),
});

const toPeriod = (year: number, month: number) => {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, end };
};

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  try {
    const json = await request.json();
    const { month, year, kind } = bodySchema.parse(json);
    const { start, end } = toPeriod(year, month);

    const data = await buildStoreReportData(supabaseServer, start, end);
    const fileName = `relatorio-${year}-${String(month).padStart(2, '0')}.${kind}`;
    const filePath = `reports/${year}/${String(month).padStart(2, '0')}/${fileName}`;

    const fileBytes =
      kind === 'pdf'
        ? await renderStoreReportPdf(data)
        : Buffer.from(renderStoreReportCsv(data), 'utf8');

    const contentType = kind === 'pdf' ? 'application/pdf' : 'text/csv';
    const upload = await supabaseServer.storage
      .from('store-reports')
      .upload(filePath, fileBytes, { contentType, upsert: true });

    if (upload.error) {
      console.error('Erro ao guardar relatório:', upload.error);
      return NextResponse.json({ message: 'Erro ao guardar relatório.' }, { status: 500 });
    }

    const totalOrders = data.paidOrders;
    const totalRevenue = data.totalRevenue;

    const { error: insertError } = await supabaseServer
      .from('store_reports')
      .upsert({
        kind,
        report_month: month,
        report_year: year,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        file_path: filePath,
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        currency: 'EUR',
        created_by: auth.user?.email || null,
      }, { onConflict: 'kind,report_month,report_year' });

    if (insertError) {
      console.warn('Não foi possível guardar metadata do relatório:', insertError);
    }

    const { data: urlData } = await supabaseServer
      .storage
      .from('store-reports')
      .createSignedUrl(filePath, 60 * 10);

    return NextResponse.json({
      ok: true,
      file: {
        path: filePath,
        name: fileName,
        downloadUrl: urlData?.signedUrl || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Pedido inválido.' }, { status: 400 });
  }
}
