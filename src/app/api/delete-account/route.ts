import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabase';
import { createHash } from 'crypto';

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
    const anonymizedId = createHash('sha256').update(userId).digest('hex').slice(0, 20);

    const operationalTables = [
      'novena_progress',
      'novena_history',
      'member_activity',
      'voluntariado_garabandal',
    ] as const;

    for (const table of operationalTables) {
      const identityColumn = table === 'voluntariado_garabandal' ? 'membro_id' : 'user_id';
      const { error } = await supabaseServer.from(table).delete().eq(identityColumn, userId);
      if (error && error.code !== '42P01') throw error;
    }

    const { error: profileError } = await supabaseServer
      .from('membros')
      .update({
        nome: 'Conta eliminada',
        email: `deleted-${anonymizedId}@sem-email.local`,
        telefone: null,
        nif: null,
        address: null,
        postal_code: null,
        country: null,
        avatar_url: null,
        is_membro: false,
        estado_quota: 'suspenso',
        tipo_subscricao: null,
        proxima_quota: null,
        referral_code: null,
      })
      .eq('id', userId);

    if (profileError) throw profileError;

    // Soft deletion revokes account access while preserving referential integrity for
    // accounting, tax, fraud-prevention and dispute records subject to legal retention.
    const { error: deleteErr } = await supabaseServer.auth.admin.deleteUser(userId, true);
    if (deleteErr) throw deleteErr;

    return NextResponse.json({
      success: true,
      message:
        'Conta eliminada. Registos transacionais sujeitos a conservação legal foram preservados.',
    });
  } catch (err: any) {
    console.error('Erro ao eliminar conta:', err);
    return NextResponse.json({ message: err?.message || 'Erro ao eliminar conta' }, { status: 500 });
  }
}
