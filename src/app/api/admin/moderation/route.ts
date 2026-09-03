import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { verifyAdmin } from '../../../../lib/admin-auth';
import { logAdminAction } from '../../../../lib/admin-logger';

export const dynamic = 'force-dynamic';

/**
 * Fila de moderacao do mural de intencoes.
 *
 * A app esconde automaticamente uma intencao ao fim de 3 denuncias distintas,
 * mas a App Store (Guideline 1.2) exige que uma pessoa possa rever as denuncias.
 * Esta rota serve essa fila e as accoes de decisao.
 */

type ReportRow = {
    id: string;
    intention_id: string;
    reporter_id: string;
    reason: string;
    created_at: string;
    resolved_at: string | null;
};

export async function GET(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    const { authorized, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
    }

    try {
        const { searchParams } = new URL(req.url);
        const includeResolved = searchParams.get('resolved') === '1';

        let query = supabaseServer
            .from('novena_intention_reports')
            .select('id, intention_id, reporter_id, reason, created_at, resolved_at')
            .order('created_at', { ascending: false })
            .limit(300);

        if (!includeResolved) query = query.is('resolved_at', null);

        const { data: reports, error: reportsError } = await query;
        if (reportsError) throw reportsError;

        const rows = (reports || []) as ReportRow[];
        if (rows.length === 0) {
            return NextResponse.json({ items: [], blockCounts: {} });
        }

        const intentionIds = Array.from(new Set(rows.map((r) => r.intention_id)));

        const { data: intentions, error: intentionsError } = await supabaseServer
            .from('novena_intentions')
            .select('id, user_id, novena_id, author_name, intention, is_anonymous, is_hidden, prayer_count, created_at')
            .in('id', intentionIds);
        if (intentionsError) throw intentionsError;

        const authorIds = Array.from(
            new Set((intentions || []).map((i) => i.user_id).filter(Boolean)),
        );

        // Quantas pessoas bloquearam cada autor: sinal util para decidir.
        const { data: blocks } = await supabaseServer
            .from('member_blocks')
            .select('blocked_id')
            .in('blocked_id', authorIds.length ? authorIds : ['00000000-0000-0000-0000-000000000000']);

        const blockCounts: Record<string, number> = {};
        for (const block of blocks || []) {
            blockCounts[block.blocked_id] = (blockCounts[block.blocked_id] || 0) + 1;
        }

        const { data: authors } = await supabaseServer
            .from('membros')
            .select('id, nome, email')
            .in('id', authorIds.length ? authorIds : ['00000000-0000-0000-0000-000000000000']);

        const authorById = new Map((authors || []).map((a) => [a.id, a]));

        // Uma entrada por intencao, com todas as denuncias agregadas.
        const items = (intentions || []).map((intention) => {
            const intentionReports = rows.filter((r) => r.intention_id === intention.id);
            const author = authorById.get(intention.user_id);

            return {
                intention: {
                    id: intention.id,
                    novena_id: intention.novena_id,
                    text: intention.intention,
                    is_anonymous: intention.is_anonymous,
                    is_hidden: intention.is_hidden,
                    prayer_count: intention.prayer_count,
                    created_at: intention.created_at,
                },
                author: {
                    id: intention.user_id,
                    name: intention.author_name || author?.nome || null,
                    email: author?.email || null,
                    blocked_by_count: blockCounts[intention.user_id] || 0,
                },
                reports: intentionReports.map((r) => ({
                    id: r.id,
                    reason: r.reason,
                    created_at: r.created_at,
                    resolved_at: r.resolved_at,
                })),
                report_count: intentionReports.length,
                open_count: intentionReports.filter((r) => !r.resolved_at).length,
            };
        });

        items.sort((a, b) => b.open_count - a.open_count || b.report_count - a.report_count);

        return NextResponse.json({ items });
    } catch (error: any) {
        console.error('[moderation] GET failed:', error);
        return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 });
    }
}

const ACTIONS = ['hide', 'restore', 'delete', 'dismiss'] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    const { authorized, user, error: authError } = await verifyAdmin(req);
    if (!authorized) {
        const status = authError === 'Forbidden: Not an Admin' ? 403 : 401;
        return NextResponse.json({ error: authError || 'Unauthorized' }, { status });
    }

    try {
        const body = await req.json();
        const action = body?.action as Action;
        const intentionId = String(body?.intentionId || '');

        if (!ACTIONS.includes(action)) {
            return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
        }
        if (!intentionId) {
            return NextResponse.json({ error: 'Intenção em falta' }, { status: 400 });
        }

        if (action === 'delete') {
            // As denúncias caem por cascade junto com a intenção.
            const { error } = await supabaseServer
                .from('novena_intentions')
                .delete()
                .eq('id', intentionId);
            if (error) throw error;
        } else {
            if (action !== 'dismiss') {
                const { error } = await supabaseServer
                    .from('novena_intentions')
                    .update({ is_hidden: action === 'hide' })
                    .eq('id', intentionId);
                if (error) throw error;
            }

            // Fechar a fila: as denúncias ficam registadas, mas deixam de estar abertas.
            const { error: resolveError } = await supabaseServer
                .from('novena_intention_reports')
                .update({ resolved_at: new Date().toISOString() })
                .eq('intention_id', intentionId)
                .is('resolved_at', null);
            if (resolveError) throw resolveError;
        }

        await logAdminAction(
            user?.email || 'unknown',
            `moderation_${action}`,
            { intentionId },
            intentionId,
        );

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('[moderation] POST failed:', error);
        return NextResponse.json({ error: error?.message || 'Erro inesperado' }, { status: 500 });
    }
}
