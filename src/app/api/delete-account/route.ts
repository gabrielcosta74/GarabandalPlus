import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ message: 'Supabase não configurado' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Token em falta' }, { status: 401 });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  try {
    const { data: userData, error: tokenErr } = await supabaseServer.auth.getUser(token);
    if (tokenErr || !userData?.user) {
      return NextResponse.json({ message: 'Token inválido' }, { status: 401 });
    }

    const userId = userData.user.id;

    // Limpa dados relacionados
    await supabaseServer.from('donations').delete().eq('user_id', userId);
    await supabaseServer.from('pagamentos_quotas').delete().eq('user_id', userId);
    await supabaseServer.from('membros').delete().eq('id', userId);

    // Remove utilizador do Auth
    const { error: deleteErr } = await supabaseServer.auth.admin.deleteUser(userId);
    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Erro ao eliminar conta:', err);
    return NextResponse.json({ message: err?.message || 'Erro ao eliminar conta' }, { status: 500 });
  }
}
