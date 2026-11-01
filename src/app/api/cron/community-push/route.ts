/**
 * Pushes sociais da Comunidade (convites para rezar, pedidos de amizade,
 * comentários, gostos), de 5 em 5 minutos.
 *
 * O cron de hora a hora (`/api/cron/push-notifications`) também as trata, mas um
 * convite para uma sala daqui a meia hora não pode esperar até 59 minutos. Os
 * atrasos de `community-push.ts` (5 min nos comentários, 10 nas entradas, 20
 * nos gostos) e a reserva de 5 min de cada envio contam com este ritmo. Correr
 * os dois ao mesmo tempo é seguro: `claim_community_push` garante um só envio.
 */
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { processCommunityPush } from '../../../../lib/community-push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ message: 'Supabase nao configurado' }, { status: 500 });
    }

    const secret = process.env.CRON_SECRET || '';
    if (!secret) {
        return NextResponse.json({ message: 'CRON_SECRET não configurado.' }, { status: 500 });
    }
    if ((request.headers.get('authorization') || '') !== `Bearer ${secret}`) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
    try {
        const community = await processCommunityPush(supabaseServer, new Date(), dryRun);
        return NextResponse.json({ ok: true, community, dryRun });
    } catch (error) {
        console.error('Community push failed:', error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : 'Community push failed' },
            { status: 500 },
        );
    }
}
