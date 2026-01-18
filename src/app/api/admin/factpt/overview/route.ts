import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const formatCount = (value?: number | null) => (Number.isFinite(value) ? Number(value) : 0);

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado.' }, { status: 500 });
  }

  try {
    const { data: rows, error } = await supabaseServer
      .from('factpt_documents')
      .select('status, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      throw error;
    }

    const counts = (rows || []).reduce(
      (acc, row) => {
        const status = row?.status || 'pending';
        acc.total += 1;
        if (status === 'issued') acc.issued += 1;
        else if (status === 'failed') acc.failed += 1;
        else acc.pending += 1;
        return acc;
      },
      { total: 0, issued: 0, pending: 0, failed: 0 },
    );

    const lastCreatedAt = rows?.[0]?.created_at || null;

    const { data: recentDocs } = await supabaseServer
      .from('factpt_documents')
      .select('id, source_type, source_ref, status, factpt_document_id, factpt_url, created_at, error')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      stats: {
        total: formatCount(counts.total),
        issued: formatCount(counts.issued),
        pending: formatCount(counts.pending),
        failed: formatCount(counts.failed),
        lastCreatedAt,
      },
      recent: recentDocs || [],
    });
  } catch (err) {
    console.error('Erro ao carregar overview fact.pt:', err);
    return NextResponse.json({ message: 'Erro ao carregar overview.' }, { status: 500 });
  }
}
