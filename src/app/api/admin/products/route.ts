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

  const { data, error } = await supabaseServer
    .from('store_products')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Erro ao carregar produtos:', error);
    return NextResponse.json({ message: 'Erro ao carregar produtos.' }, { status: 500 });
  }

  return NextResponse.json({ products: data || [] });
}
