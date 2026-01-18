import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/admin-auth';
import { supabaseServer } from '../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  const server = supabaseServer;
  const { data, error } = await server
    .from('store_reports')
    .select('id, kind, report_month, report_year, period_start, period_end, file_path, created_at, total_orders, total_revenue, currency')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Erro ao carregar relatórios:', error);
    return NextResponse.json({ message: 'Erro ao carregar relatórios.' }, { status: 500 });
  }

  const reportsWithUrls = await Promise.all(
    (data || []).map(async (report) => {
      const { data: urlData } = await server
        .storage
        .from('store-reports')
        .createSignedUrl(report.file_path, 60 * 10);
      return {
        ...report,
        download_url: urlData?.signedUrl || null,
      };
    }),
  );

  return NextResponse.json({ reports: reportsWithUrls });
}
