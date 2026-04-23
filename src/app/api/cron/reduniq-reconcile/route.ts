import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { runReconcile } from '../../../../lib/reduniq-reconcile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
    }
    const secret = process.env.CRON_SECRET || '';
    if (!secret) return NextResponse.json({ message: 'CRON_SECRET não configurado.' }, { status: 500 });
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const windowDays = Number(url.searchParams.get('windowDays') || 7);
    const minAgeMinutes = Number(url.searchParams.get('minAgeMinutes') || 30);

    try {
        const { results, summary } = await runReconcile(supabaseServer, {
            windowDays,
            minAgeMinutes,
            apply: true,
            markFailed: true,
        });

        const reconciled = results
            .filter((r) => r.applied || r.markedFailed)
            .map((r) => ({
                kind: r.row.kind,
                orderRef: r.row.order_ref,
                amount: r.row.amount,
                email: r.row.email || null,
                classification: r.classification,
                applied: r.applied,
                markedFailed: r.markedFailed,
                gatewayTxId: r.gatewayTxId,
            }));

        console.log('[cron/reduniq-reconcile]', JSON.stringify({ summary, windowDays, minAgeMinutes, reconciled }));
        return NextResponse.json({ ok: true, summary, reconciled });
    } catch (e: any) {
        console.error('[cron/reduniq-reconcile] error', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
