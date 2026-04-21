import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { verifyAdmin } from '../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { authorized, error } = await verifyAdmin(req);
  if (!authorized) return NextResponse.json({ error }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'Erro de configuração' }, { status: 500 });

  const { data, error: dbError } = await supabaseServer
    .from('prayer_managers')
    .select('id, email, name, created_at')
    .order('created_at', { ascending: false });

  if (dbError) return NextResponse.json({ error: 'Erro ao carregar gestores' }, { status: 500 });
  return NextResponse.json({ managers: data ?? [] });
}

export async function POST(req: Request) {
  const { authorized, error } = await verifyAdmin(req);
  if (!authorized) return NextResponse.json({ error }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'Erro de configuração' }, { status: 500 });

  const body = await req.json() as { email?: string; name?: string };
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim() || null;

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  const { data, error: dbError } = await supabaseServer
    .from('prayer_managers')
    .insert({ email, name })
    .select()
    .single();

  if (dbError) {
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'Este email já está na lista' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro ao adicionar gestor' }, { status: 500 });
  }

  return NextResponse.json({ manager: data }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { authorized, error } = await verifyAdmin(req);
  if (!authorized) return NextResponse.json({ error }, { status: 401 });
  if (!supabaseServer) return NextResponse.json({ error: 'Erro de configuração' }, { status: 500 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'ID em falta' }, { status: 400 });

  const { error: dbError } = await supabaseServer
    .from('prayer_managers')
    .delete()
    .eq('id', id);

  if (dbError) return NextResponse.json({ error: 'Erro ao remover gestor' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
