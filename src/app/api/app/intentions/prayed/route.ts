import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../../lib/auth-utils';
import { notifyFirstPrayer } from '../../../../../lib/intention-notifications';
import { supabaseServer } from '../../../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A app chama isto logo depois de um membro rezar por uma intencao, para o
 * autor saber no momento que alguem rezou por ele.
 *
 * So faz alguma coisa na PRIMEIRA oracao de cada intencao (o resto vai no
 * resumo diario do cron), e so se a oracao deste membro existir mesmo na base
 * de dados: nao e possivel usar esta rota para mandar pushes a alguem.
 */
export async function POST(request: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as { intentionId?: unknown } | null;
    const intentionId = typeof body?.intentionId === 'string' ? body.intentionId : '';
    if (!UUID.test(intentionId)) {
        return NextResponse.json({ error: 'Invalid intention' }, { status: 400 });
    }

    const { data: prayer } = await supabaseServer
        .from('novena_intention_prayers')
        .select('intention_id')
        .eq('intention_id', intentionId)
        .eq('user_id', user.id)
        .maybeSingle();
    if (!prayer) {
        return NextResponse.json({ error: 'Prayer not found' }, { status: 404 });
    }

    const outcome = await notifyFirstPrayer(supabaseServer, intentionId);
    return NextResponse.json({ ok: true, outcome });
}
