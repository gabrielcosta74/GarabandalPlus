import { SupabaseClient } from '@supabase/supabase-js';
import { reduniqClient } from './reduniq/client';
import {
    handleDonationSuccess,
    handleMembershipSuccess,
    handlePilgrimageSuccess,
    handleStoreSuccess,
    PaymentHandlerContext,
} from './payment-handlers';

export type ReconcileKind = 'quota' | 'donation' | 'pilgrimage' | 'store';
export type ReconcileClassification = 'CONFIRMED_PAID' | 'PENDING_AT_GATEWAY' | 'FAILED' | 'UNKNOWN' | 'REDUNIQ_ERROR';

export type ReconcileRow = {
    kind: ReconcileKind;
    id: string;
    user_id?: string | null;
    order_ref: string;
    token: string | null;
    amount: number;
    email?: string | null;
    name?: string | null;
    metadata?: any;
    raw: any;
};

export type ReconcileResult = {
    row: ReconcileRow;
    classification: ReconcileClassification;
    gatewayStatus: string | null;
    gatewayTxId: string | null;
    gatewayDate: string | null;
    applied: boolean;
    markedFailed?: boolean;
    error?: string;
    errorDisposition?: 'retry' | 'review';
};

export type ReconcileOptions = {
    // Optional administrative lookback. The cron leaves this unset so a
    // confirmed payment can never age out of reconciliation.
    windowDays?: number;
    minAgeMinutes?: number;       // ignore rows newer than this (default 30) to let in-flight settle
    kinds?: ReconcileKind[];
    apply?: boolean;              // run handlers on CONFIRMED_PAID
    markFailed?: boolean;         // mark FAILED rows as failed in DB
    onlyRef?: string;
};

export async function loadPendingRows(
    supabase: SupabaseClient,
    opts: ReconcileOptions,
): Promise<ReconcileRow[]> {
    const windowDays = opts.windowDays;
    if (
        windowDays !== undefined
        && (!Number.isFinite(windowDays) || windowDays <= 0)
    ) {
        throw new Error('windowDays must be a positive number when provided.');
    }
    const kinds = opts.kinds ?? (['quota', 'donation', 'pilgrimage', 'store'] as ReconcileKind[]);
    const cutoffIso = windowDays === undefined
        ? null
        : new Date(Date.now() - windowDays * 86400 * 1000).toISOString();
    const minAgeIso = new Date(Date.now() - (opts.minAgeMinutes ?? 30) * 60 * 1000).toISOString();
    const rows: ReconcileRow[] = [];

    if (kinds.includes('quota')) {
        let query = supabase
            .from('pagamentos_quotas')
            .select('id, user_id, valor, estado, payment_intent_id, external_reference, data_pagamento, notes')
            .in('estado', ['pendente', 'pending'])
            .like('metodo_pagamento', 'reduniq%');
        if (cutoffIso) {
            query = query.gte('data_pagamento', cutoffIso.slice(0, 10));
        }
        const { data, error } = await query;
        if (error) {
            throw new Error(`Falha ao carregar quotas pendentes: ${error.message}`);
        }
        for (const r of data || []) {
            rows.push({ kind: 'quota', id: String(r.id), user_id: r.user_id, order_ref: r.external_reference, token: r.payment_intent_id, amount: Number(r.valor), raw: r });
        }
    }

    if (kinds.includes('donation')) {
        let query = supabase
            .from('donations')
            .select('id, user_id, amount_cents, currency, status, method, payment_intent_id, external_reference, donor_email, donor_name, metadata, created_at')
            .eq('status', 'pending')
            .lte('created_at', minAgeIso);
        if (cutoffIso) {
            query = query.gte('created_at', cutoffIso);
        }
        const { data, error } = await query;
        if (error) {
            throw new Error(`Falha ao carregar donativos pendentes: ${error.message}`);
        }
        for (const r of data || []) {
            if ((r.metadata as any)?.provider !== 'reduniq') continue;
            rows.push({ kind: 'donation', id: String(r.id), user_id: r.user_id, order_ref: r.external_reference, token: r.payment_intent_id, amount: Number(r.amount_cents) / 100, email: r.donor_email, name: r.donor_name, metadata: r.metadata, raw: r });
        }
    }

    if (kinds.includes('pilgrimage')) {
        let query = supabase
            .from('pilgrimage_payments')
            .select('id, booking_id, user_id, amount, status, method, payment_intent_id, external_reference, notes, created_at')
            .in('status', ['pending', 'pending_payment'])
            .like('method', 'reduniq%')
            .lte('created_at', minAgeIso);
        if (cutoffIso) {
            query = query.gte('created_at', cutoffIso);
        }
        const { data, error } = await query;
        if (error) {
            throw new Error(`Falha ao carregar pagamentos de peregrinação pendentes: ${error.message}`);
        }
        for (const r of data || []) {
            rows.push({ kind: 'pilgrimage', id: String(r.id), user_id: r.user_id, order_ref: r.external_reference, token: r.payment_intent_id, amount: Number(r.amount), raw: r });
        }
    }

    if (kinds.includes('store')) {
        let query = supabase
            .from('store_orders')
            .select('id, order_ref, buyer_email, buyer_name, total_amount, status, payment_provider, payment_reference, currency, created_at, buyer_user_id')
            .eq('status', 'pending')
            .eq('payment_provider', 'reduniq')
            .lte('created_at', minAgeIso);
        if (cutoffIso) {
            query = query.gte('created_at', cutoffIso);
        }
        const { data, error } = await query;
        if (error) {
            throw new Error(`Falha ao carregar encomendas pendentes: ${error.message}`);
        }
        for (const r of data || []) {
            rows.push({ kind: 'store', id: String(r.id), user_id: r.buyer_user_id, order_ref: r.order_ref, token: r.payment_reference, amount: Number(r.total_amount), email: r.buyer_email, name: r.buyer_name, raw: r });
        }
    }

    if (opts.onlyRef) return rows.filter((r) => r.order_ref === opts.onlyRef);
    return rows;
}

function parseGatewayDate(raw: any): Date | undefined {
    if (!raw) return undefined;
    const s = String(raw).trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

function bestFromSearch(search: any): { status: string; transactionId: string | null; date: string | null } | null {
    if (!search) return null;
    const list: any[] = [];
    const push = (n: any) => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { for (const v of n) push(v); return; }
        if (n.transaction?.status || n.status) list.push(n);
        for (const v of Object.values(n)) if (v && typeof v === 'object') push(v);
    };
    push(search);
    const normalized = list.map((n) => ({
        status: String(n?.transaction?.status ?? n?.status ?? ''),
        transactionId: n?.transaction?.id || n?.transactionId || n?.id || null,
        date: n?.transaction?.date || n?.date || null,
    })).filter((n) => n.status);
    if (!normalized.length) return null;
    const score = (s: string) => (s === '4' ? 4 : s === '3' ? 3 : s === '2' ? 2 : s === '1' ? 1 : 0);
    normalized.sort((a, b) => score(b.status) - score(a.status) || String(b.date || '').localeCompare(String(a.date || '')));
    return normalized[0];
}

export async function classifyRow(row: ReconcileRow): Promise<ReconcileResult> {
    try {
        let gatewayStatus: string | null = null;
        let gatewayTxId: string | null = null;
        let gatewayDate: string | null = null;
        let reduniqError: string | null = null;
        let errorDisposition: 'retry' | 'review' | undefined;

        if (row.token) {
            const gs = await reduniqClient.getOrderStatus(row.token);
            if (gs.success) {
                gatewayStatus = gs.status === 'success' ? '4' : gs.status === 'failed' ? '3' : gs.status === 'pending' ? '2' : null;
                gatewayTxId = gs.transactionId || null;
                gatewayDate = (gs.raw as any)?.transaction?.date || null;
            } else {
                reduniqError = gs.error || 'getOrderStatus failed';
                errorDisposition = gs.resultCode === '00100007'
                    || /invalid token/i.test(reduniqError)
                    ? 'review'
                    : 'retry';
            }
        }

        const hasTerminalTokenStatus = gatewayStatus === '4' || gatewayStatus === '3';
        if (!hasTerminalTokenStatus) {
            const search = await reduniqClient.searchTransactions({ orderRef: row.order_ref, limit: 25 });

            if (search.ok) {
                const best = bestFromSearch(search.data);
                if (best) {
                    const searchIsTerminal = best.status === '4' || best.status === '3';
                    if (!gatewayStatus || searchIsTerminal) {
                        gatewayStatus = best.status;
                        gatewayTxId = best.transactionId;
                        gatewayDate = best.date;
                    }
                }
            } else {
                reduniqError = search.error || `searchTransactions failed (${search.status})`;
                // A failed fallback search is an operational failure even when
                // getResult previously reported a permanently invalid token.
                errorDisposition = 'retry';
            }
        }

        let classification: ReconcileClassification = 'UNKNOWN';
        if (gatewayStatus === '4') classification = 'CONFIRMED_PAID';
        else if (gatewayStatus === '3') classification = 'FAILED';
        else if (['0', '1', '2'].includes(gatewayStatus || '')) classification = 'PENDING_AT_GATEWAY';
        else if (reduniqError) classification = 'REDUNIQ_ERROR';

        return {
            row,
            classification,
            gatewayStatus,
            gatewayTxId,
            gatewayDate,
            applied: false,
            error: classification === 'REDUNIQ_ERROR'
                ? reduniqError || 'Falha desconhecida ao consultar a Reduniq.'
                : undefined,
            errorDisposition: classification === 'REDUNIQ_ERROR'
                ? errorDisposition || 'retry'
                : undefined,
        };
    } catch (e: any) {
        return {
            row,
            classification: 'REDUNIQ_ERROR',
            gatewayStatus: null,
            gatewayTxId: null,
            gatewayDate: null,
            applied: false,
            error: e.message,
            errorDisposition: 'retry',
        };
    }
}

export async function applyConfirmed(supabase: SupabaseClient, res: ReconcileResult): Promise<void> {
    if (res.classification !== 'CONFIRMED_PAID') return;
    const row = res.row;
    const amountCents = Math.round(row.amount * 100);
    const base: PaymentHandlerContext = {
        supabaseServer: supabase,
        amountCents,
        currency: 'EUR',
        paymentReference: row.token || res.gatewayTxId || row.order_ref,
        externalReference: row.order_ref,
        method: 'reduniq',
        metadata: {},
        paymentDate: parseGatewayDate(res.gatewayDate),
    };

    if (row.kind === 'donation') {
        const md: any = row.metadata || {};
        await handleDonationSuccess({
            ...base,
            metadata: {
                type: 'donation',
                userId: row.user_id,
                donorName: md.donorName || row.name,
                donorEmail: md.donorEmail || row.email,
                donorNif: md.donorNif || null,
                donorAddress: md.donorAddress || null,
                donorCity: md.donorCity || null,
                donorZip: md.donorZip || null,
                donorCountry: md.donorCountry || null,
                receiptRequired: md.receiptRequired ?? false,
                locale: md.locale || 'pt',
                reduniq_method: md.reduniq_method || null,
                reduniqTransactionId: res.gatewayTxId,
            },
            customerDetails: { name: row.name || null, email: row.email || null },
        });
    } else if (row.kind === 'quota') {
        await handleMembershipSuccess({
            ...base,
            metadata: {
                type: 'membership',
                userId: row.user_id,
                reduniqTransactionId: res.gatewayTxId,
                locale: /\[locale:en\]/i.test(String(row.raw?.notes || '')) ? 'en' : 'pt',
            },
        });
    } else if (row.kind === 'pilgrimage') {
        await handlePilgrimageSuccess({
            ...base,
            metadata: {
                type: 'pilgrimage_payment',
                booking_id: row.raw?.booking_id,
                userId: row.user_id,
                reduniqTransactionId: res.gatewayTxId,
                existingNotes: row.raw?.notes || null,
            },
        });
    } else if (row.kind === 'store') {
        await handleStoreSuccess({
            ...base,
            metadata: { type: 'store', orderRef: row.order_ref, reduniqTransactionId: res.gatewayTxId },
            customerDetails: { name: row.name || null, email: row.email || null },
        });
    }
    res.applied = true;
}

export async function markFailed(supabase: SupabaseClient, res: ReconcileResult): Promise<void> {
    if (res.classification !== 'FAILED') return;
    const { kind, id } = res.row;
    const result = kind === 'donation'
        ? await supabase.from('donations').update({ status: 'failed' }).eq('id', id)
        : kind === 'quota'
            ? await supabase.from('pagamentos_quotas').update({ estado: 'failed' }).eq('id', id)
            : kind === 'pilgrimage'
                ? await supabase.from('pilgrimage_payments').update({ status: 'failed' }).eq('id', id)
                : await supabase.from('store_orders').update({ status: 'failed' }).eq('id', id);
    if (result.error) {
        throw new Error(`Falha ao marcar ${kind} como falhado: ${result.error.message}`);
    }
    res.markedFailed = true;
}

export async function runReconcile(
    supabase: SupabaseClient,
    opts: ReconcileOptions,
): Promise<{ results: ReconcileResult[]; summary: Record<string, number> }> {
    const rows = await loadPendingRows(supabase, opts);
    const results: ReconcileResult[] = [];
    for (const row of rows) {
        const res = await classifyRow(row);
        try {
            if (opts.apply && res.classification === 'CONFIRMED_PAID') await applyConfirmed(supabase, res);
            else if (opts.markFailed && res.classification === 'FAILED') await markFailed(supabase, res);
        } catch (e: any) {
            res.error = e.message;
        }
        results.push(res);
        await new Promise((r) => setTimeout(r, 100));
    }
    const summary: Record<string, number> = {};
    for (const r of results) summary[r.classification] = (summary[r.classification] || 0) + 1;
    summary.applied = results.filter((r) => r.applied).length;
    summary.markedFailed = results.filter((r) => r.markedFailed).length;
    summary.errors = results.filter((r) => Boolean(r.error)).length;
    return { results, summary };
}
