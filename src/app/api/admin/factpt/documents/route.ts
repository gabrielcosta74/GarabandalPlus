import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/admin-auth';
import { supabaseServer } from '../../../../../lib/supabase';

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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const sourceType = searchParams.get('type');

  let query = supabaseServer
    .from('factpt_documents')
    .select('id, source_type, source_ref, status, factpt_document_id, factpt_url, created_at, error')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (sourceType && sourceType !== 'all') {
    query = query.eq('source_type', sourceType);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Erro ao carregar documentos fact.pt:', error);
    return NextResponse.json({ message: 'Erro ao carregar documentos.' }, { status: 500 });
  }

  return NextResponse.json({ documents: data || [] });
}
