/**
 * Reconcile pending Reduniq payments against the gateway's truth.
 *
 * Usage:
 *   npx tsx scripts/reconcile-reduniq.ts                         # dry-run, 90d, all kinds
 *   npx tsx scripts/reconcile-reduniq.ts --apply                 # actually run handlers
 *   npx tsx scripts/reconcile-reduniq.ts --only-ref=<orderRef>
 *   npx tsx scripts/reconcile-reduniq.ts --only-email=<email>
 *   npx tsx scripts/reconcile-reduniq.ts --kinds=quota,donation
 *   npx tsx scripts/reconcile-reduniq.ts --window=30
 *   npx tsx scripts/reconcile-reduniq.ts --skip-test-emails
 *
 * Behavior:
 *   - Queries pending rows in pagamentos_quotas, donations, pilgrimage_payments, store_orders
 *   - For each row, calls Reduniq searchTransactions(orderRef) + getResult(token)
 *   - Classifies: CONFIRMED_PAID | PENDING_AT_GATEWAY | FAILED | UNKNOWN
 *   - In --apply mode invokes the existing idempotent handlers for CONFIRMED_PAID rows
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { ReduniqClient } from '../src/lib/reduniq/client';
import { supabaseServer } from '../src/lib/supabase';
import {
    handleDonationSuccess,
    handleMembershipSuccess,
    handlePilgrimageSuccess,
    handleStoreSuccess,
    PaymentHandlerContext,
} from '../src/lib/payment-handlers';

type Kind = 'quota' | 'donation' | 'pilgrimage' | 'store';
type Classification = 'CONFIRMED_PAID' | 'PENDING_AT_GATEWAY' | 'FAILED' | 'UNKNOWN' | 'REDUNIQ_ERROR';

type Row = {
    kind: Kind;
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

type ReconcileResult = {
    row: Row;
    classification: Classification;
    gatewayStatus: string | null;
    gatewayTxId: string | null;
    gatewayDate: string | null;
    applied: boolean;
    error?: string;
    note?: string;
};

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const arg = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.substring(name.length + 3) : null;
};

const APPLY = flag('apply');
const MARK_FAILED = flag('mark-failed');
const WINDOW_DAYS = Number(arg('window') || 90);
const ONLY_REF = arg('only-ref');
const ONLY_EMAIL = arg('only-email');
const KINDS = (arg('kinds') || 'quota,donation,pilgrimage,store').split(',').map((s) => s.trim()) as Kind[];
const SKIP_TESTS = flag('skip-test-emails');

const TEST_EMAIL_PATTERNS = [
    /@example\.com$/i,
    /^teste@/i,
    /^test@/i,
    /^qa-/i,
    /^asd+@/i,
    /^gabriel@gmail\.com$/i,
    /^gabs@/i,
    /rardo025@gmail\.com/i,
];
const isTestEmail = (email?: string | null) => !!email && TEST_EMAIL_PATTERNS.some((r) => r.test(email));

const client = new ReduniqClient();

if (!supabaseServer) {
    console.error('supabaseServer is null — check NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

async function loadRows(): Promise<Row[]> {
    const out: Row[] = [];
    const windowCutoff = new Date(Date.now() - WINDOW_DAYS * 86400 * 1000).toISOString();

    if (KINDS.includes('quota')) {
        const { data, error } = await supabaseServer!
            .from('pagamentos_quotas')
            .select('id, user_id, valor, estado, payment_intent_id, external_reference, data_pagamento, notes')
            .in('estado', ['pendente', 'pending'])
            .eq('metodo_pagamento', 'reduniq')
            .gte('data_pagamento', windowCutoff.slice(0, 10))
            .order('data_pagamento', { ascending: false });
        if (error) console.warn('quota query:', error.message);
        for (const r of data || []) {
            out.push({
                kind: 'quota',
                id: String(r.id),
                user_id: r.user_id,
                order_ref: r.external_reference,
                token: r.payment_intent_id,
                amount: Number(r.valor),
                raw: r,
            });
        }
    }

    if (KINDS.includes('donation')) {
        const { data, error } = await supabaseServer!
            .from('donations')
            .select('id, user_id, amount_cents, currency, status, method, payment_intent_id, external_reference, donor_email, donor_name, metadata, created_at')
            .eq('status', 'pending')
            .gte('created_at', windowCutoff)
            .order('created_at', { ascending: false });
        if (error) console.warn('donation query:', error.message);
        for (const r of data || []) {
            const provider = (r.metadata as any)?.provider;
            if (provider !== 'reduniq') continue;
            out.push({
                kind: 'donation',
                id: String(r.id),
                user_id: r.user_id,
                order_ref: r.external_reference,
                token: r.payment_intent_id,
                amount: Number(r.amount_cents) / 100,
                email: r.donor_email,
                name: r.donor_name,
                metadata: r.metadata,
                raw: r,
            });
        }
    }

    if (KINDS.includes('pilgrimage')) {
        const { data, error } = await supabaseServer!
            .from('pilgrimage_payments')
            .select('id, booking_id, user_id, amount, status, method, payment_intent_id, external_reference, created_at')
            .in('status', ['pending', 'pending_payment'])
            .eq('method', 'reduniq')
            .gte('created_at', windowCutoff)
            .order('created_at', { ascending: false });
        if (error) console.warn('pilgrimage query:', error.message);
        for (const r of data || []) {
            out.push({
                kind: 'pilgrimage',
                id: String(r.id),
                user_id: r.user_id,
                order_ref: r.external_reference,
                token: r.payment_intent_id,
                amount: Number(r.amount),
                raw: r,
            });
        }
    }

    if (KINDS.includes('store')) {
        const { data, error } = await supabaseServer!
            .from('store_orders')
            .select('id, order_ref, buyer_email, buyer_name, total_amount, status, payment_provider, payment_reference, currency, created_at, buyer_user_id')
            .eq('status', 'pending')
            .eq('payment_provider', 'reduniq')
            .gte('created_at', windowCutoff)
            .order('created_at', { ascending: false });
        if (error) console.warn('store query:', error.message);
        for (const r of data || []) {
            out.push({
                kind: 'store',
                id: String(r.id),
                user_id: r.buyer_user_id,
                order_ref: r.order_ref,
                token: r.payment_reference,
                amount: Number(r.total_amount),
                email: r.buyer_email,
                name: r.buyer_name,
                raw: r,
            });
        }
    }

    return out;
}

/** Scan searchTransactions result for best status. status "4" wins, most recent first. */
function bestFromSearch(search: any): { status: string; transactionId: string | null; date: string | null } | null {
    if (!search) return null;
    const list: any[] = [];
    const push = (node: any) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { for (const n of node) push(n); return; }
        if (node.transaction?.status || node.status) list.push(node);
        for (const v of Object.values(node)) if (v && typeof v === 'object') push(v);
    };
    push(search);
    const normalized = list.map((n) => ({
        status: String(n?.transaction?.status ?? n?.status ?? ''),
        transactionId: n?.transaction?.id || n?.transactionId || n?.id || null,
        date: n?.transaction?.date || n?.date || null,
    })).filter((n) => n.status);
    if (!normalized.length) return null;
    const score = (s: string) => (s === '4' ? 4 : s === '2' ? 3 : s === '1' ? 2 : s === '0' ? 1 : 0);
    normalized.sort((a, b) => score(b.status) - score(a.status) || (String(b.date || '')).localeCompare(String(a.date || '')));
    return normalized[0];
}

async function classify(row: Row): Promise<ReconcileResult> {
    try {
        const search = await client.searchTransactions({ orderRef: row.order_ref, limit: 25 });
        let gatewayStatus: string | null = null;
        let gatewayTxId: string | null = null;
        let gatewayDate: string | null = null;
        let note: string | undefined;

        if (search.ok) {
            const best = bestFromSearch(search.data);
            if (best) {
                gatewayStatus = best.status;
                gatewayTxId = best.transactionId;
                gatewayDate = best.date;
            }
        } else {
            note = `searchTransactions failed: ${search.error || search.status}`;
        }

        // Fallback: if no conclusive search result, use getResult(token).
        if (!gatewayStatus && row.token) {
            const gs = await client.getOrderStatus(row.token);
            if (gs.success) {
                gatewayStatus = gs.status === 'success' ? '4' : gs.status === 'failed' ? '3' : gs.status === 'pending' ? '2' : null;
                gatewayTxId = gs.transactionId || null;
            } else if (!note) {
                note = `getOrderStatus failed: ${gs.error || ''}`;
            }
        }

        let classification: Classification = 'UNKNOWN';
        if (gatewayStatus === '4') classification = 'CONFIRMED_PAID';
        else if (gatewayStatus === '3') classification = 'FAILED';
        else if (['0', '1', '2'].includes(gatewayStatus || '')) classification = 'PENDING_AT_GATEWAY';
        else if (note && note.startsWith('searchTransactions failed')) classification = 'REDUNIQ_ERROR';

        return { row, classification, gatewayStatus, gatewayTxId, gatewayDate, applied: false, note };
    } catch (e: any) {
        return { row, classification: 'REDUNIQ_ERROR', gatewayStatus: null, gatewayTxId: null, gatewayDate: null, applied: false, error: e.message };
    }
}

async function applyReconciliation(res: ReconcileResult): Promise<void> {
    if (res.classification !== 'CONFIRMED_PAID') return;
    const row = res.row;
    const amountCents = Math.round(row.amount * 100);

    const baseCtx: PaymentHandlerContext = {
        supabaseServer: supabaseServer!,
        amountCents,
        currency: 'EUR',
        paymentReference: row.token || res.gatewayTxId || row.order_ref,
        externalReference: row.order_ref,
        method: 'reduniq',
        metadata: {},
        paymentDate: (() => {
            if (!res.gatewayDate) return undefined;
            const raw = String(res.gatewayDate).trim();
            const normalized = raw.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
            const d = new Date(normalized);
            return Number.isNaN(d.getTime()) ? undefined : d;
        })(),
    };

    if (row.kind === 'donation') {
        const md: any = row.metadata || {};
        const ctx: PaymentHandlerContext = {
            ...baseCtx,
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
        };
        await handleDonationSuccess(ctx);
    } else if (row.kind === 'quota') {
        const ctx: PaymentHandlerContext = {
            ...baseCtx,
            metadata: {
                type: 'membership',
                userId: row.user_id,
                reduniqTransactionId: res.gatewayTxId,
                locale: /\[locale:en\]/i.test(String(row.raw?.notes || '')) ? 'en' : 'pt',
            },
        };
        await handleMembershipSuccess(ctx);
    } else if (row.kind === 'pilgrimage') {
        const ctx: PaymentHandlerContext = {
            ...baseCtx,
            metadata: {
                type: 'pilgrimage_payment',
                booking_id: row.raw?.booking_id,
                userId: row.user_id,
                reduniqTransactionId: res.gatewayTxId,
                existingNotes: row.raw?.notes || null,
            },
        };
        await handlePilgrimageSuccess(ctx);
    } else if (row.kind === 'store') {
        const ctx: PaymentHandlerContext = {
            ...baseCtx,
            metadata: { type: 'store', orderRef: row.order_ref, reduniqTransactionId: res.gatewayTxId },
            customerDetails: { name: row.name || null, email: row.email || null },
        };
        await handleStoreSuccess(ctx);
    }
    res.applied = true;
}

async function applyFailedMark(res: ReconcileResult): Promise<void> {
    if (res.classification !== 'FAILED') return;
    const row = res.row;
    if (row.kind === 'donation') {
        await supabaseServer!.from('donations').update({ status: 'failed' }).eq('id', row.id);
    } else if (row.kind === 'quota') {
        await supabaseServer!.from('pagamentos_quotas').update({ estado: 'failed' }).eq('id', row.id);
    } else if (row.kind === 'pilgrimage') {
        await supabaseServer!.from('pilgrimage_payments').update({ status: 'failed' }).eq('id', row.id);
    } else if (row.kind === 'store') {
        await supabaseServer!.from('store_orders').update({ status: 'failed' }).eq('id', row.id);
    }
    res.applied = true;
}

async function main() {
    console.log(`[reconcile-reduniq] mode=${APPLY ? 'APPLY' : 'DRY-RUN'} window=${WINDOW_DAYS}d kinds=${KINDS.join(',')}${ONLY_REF ? ` onlyRef=${ONLY_REF}` : ''}${ONLY_EMAIL ? ` onlyEmail=${ONLY_EMAIL}` : ''}${SKIP_TESTS ? ' skipTestEmails=true' : ''}`);

    let rows = await loadRows();
    if (ONLY_REF) rows = rows.filter((r) => r.order_ref === ONLY_REF);
    if (ONLY_EMAIL) rows = rows.filter((r) => (r.email || '').toLowerCase() === ONLY_EMAIL.toLowerCase());
    if (SKIP_TESTS) rows = rows.filter((r) => !isTestEmail(r.email));

    console.log(`Loaded ${rows.length} pending rows.`);

    const results: ReconcileResult[] = [];
    for (const row of rows) {
        process.stdout.write(`  [${row.kind}] ${row.order_ref} (${row.amount}€${row.email ? ` ${row.email}` : ''}) ... `);
        const res = await classify(row);
        if (APPLY && res.classification === 'CONFIRMED_PAID') {
            try {
                await applyReconciliation(res);
                console.log(`${res.classification}  APPLIED (txId=${res.gatewayTxId})`);
            } catch (e: any) {
                res.error = e.message;
                console.log(`${res.classification}  APPLY_FAILED: ${e.message}`);
            }
        } else if (MARK_FAILED && res.classification === 'FAILED') {
            try {
                await applyFailedMark(res);
                console.log(`FAILED  MARKED_FAILED`);
            } catch (e: any) {
                res.error = e.message;
                console.log(`FAILED  MARK_FAIL_ERR: ${e.message}`);
            }
        } else {
            console.log(`${res.classification}${res.gatewayStatus ? ` (gw=${res.gatewayStatus})` : ''}${res.note ? ` — ${res.note}` : ''}`);
        }
        results.push(res);
        await new Promise((r) => setTimeout(r, 120)); // gentle rate limit
    }

    const summary: Record<string, number> = {};
    for (const r of results) summary[r.classification] = (summary[r.classification] || 0) + 1;
    console.log('\n--- Summary ---');
    for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);

    const appliedCount = results.filter((r) => r.applied).length;
    if (APPLY) console.log(`  applied: ${appliedCount}`);

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = path.join(process.cwd(), `reconcile-reduniq-${stamp}.json`);
    fs.writeFileSync(logPath, JSON.stringify({ mode: APPLY ? 'APPLY' : 'DRY_RUN', windowDays: WINDOW_DAYS, kinds: KINDS, results }, null, 2));
    console.log(`\nLog: ${logPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
