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
    const windowParam = url.searchParams.get('windowDays');
    const windowDays = windowParam === null ? undefined : Number(windowParam);
    const minAgeMinutes = Number(url.searchParams.get('minAgeMinutes') || 30);
    if (
        (windowDays !== undefined && (!Number.isFinite(windowDays) || windowDays <= 0))
        || !Number.isFinite(minAgeMinutes)
        || minAgeMinutes < 0
    ) {
        return NextResponse.json(
            { ok: false, error: 'Parâmetros de reconciliação inválidos.' },
            { status: 400 },
        );
    }

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
        const failures = results
            .filter((r) => Boolean(r.error))
            .map((r) => ({
                kind: r.row.kind,
                orderRef: r.row.order_ref,
                classification: r.classification,
                error: r.error,
                disposition: r.errorDisposition || 'retry',
            }));
        const blockingFailures = failures.filter((failure) => failure.disposition === 'retry');
        const reviewRequired = failures.filter((failure) => failure.disposition === 'review');

        console.log('[cron/reduniq-reconcile]', JSON.stringify({
            summary,
            windowDays: windowDays ?? 'all',
            minAgeMinutes,
            reconciled,
            blockingFailures,
            reviewRequired,
        }));
        if (blockingFailures.length > 0) {
            return NextResponse.json(
                {
                    ok: false,
                    summary,
                    reconciled,
                    failures: blockingFailures,
                    reviewRequired,
                },
                { status: 502 },
            );
        }
        return NextResponse.json({
            ok: true,
            summary,
            reconciled,
            reviewRequired,
        });
    } catch (e: any) {
        console.error('[cron/reduniq-reconcile] error', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
