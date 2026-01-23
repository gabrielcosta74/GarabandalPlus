import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';

// Helper to validate Admin Session (Consistency with other admin routes)
const isAdmin = async (req: Request) => {
    if (!supabaseServer) return false;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return false;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseServer.auth.getUser(token);
    return !error && !!user;
};

export async function GET(req: Request) {
    if (!await isAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    try {
        // 1. Fetch Donations
        const { data: donations } = await supabaseServer
            .from('donations')
            .select('id, amount_cents, currency, status, created_at, method, donors(full_name, email)')
            .order('created_at', { ascending: false });

        // 2. Fetch Store Orders
        const { data: orders } = await supabaseServer
            .from('store_orders')
            .select('*')
            .order('created_at', { ascending: false });

        // 3. Fetch Pilgrimage Payments
        const { data: pilgrimagePayments } = await supabaseServer
            .from('pilgrimage_payments')
            .select('*, bookings(user_id, pilgrimages(title))')
            .order('created_at', { ascending: false });

        // 4. Fetch Quota Payments
        const { data: quotaPayments } = await supabaseServer
            .from('pagamentos_quotas')
            .select('*, membros(nome, email)')
            .order('data_pagamento', { ascending: false });

        // Consolidate Data
        const transactions: any[] = [];

        // Map Donations
        (donations || []).forEach(d => {
            transactions.push({
                id: d.id,
                category: 'donation',
                reference: `DON-${d.id.slice(0, 8)}`,
                amount: (d.amount_cents || 0) / 100,
                currency: d.currency || 'EUR',
                customer_name: (d.donors as any)?.full_name || 'Doador Anónimo',
                customer_email: (d.donors as any)?.email || '—',
                status: d.status,
                method: d.method,
                provider: 'Stripe',
                created_at: d.created_at,
                details_link: `/admin/doacoes?id=${d.id}`
            });
        });

        // Map Store Orders
        (orders || []).forEach(o => {
            transactions.push({
                id: o.id,
                category: 'shop',
                reference: o.order_reference || `SHOP-${o.id.slice(0, 8)}`,
                amount: o.total_amount,
                currency: o.currency || 'EUR',
                customer_name: o.shipping_name,
                customer_email: o.customer_email,
                status: o.status,
                method: o.payment_method,
                provider: o.payment_reference?.startsWith('re_') ? 'Reduniq' : 'Stripe',
                created_at: o.created_at,
                customer_nif: o.buyer_nif,
                customer_address: o.shipping_address1,
                customer_city: o.shipping_city,
                customer_zip: o.shipping_postal_code,
                customer_country: o.shipping_country,
                details_link: `/admin/loja?order=${o.id}`
            });
        });

        // Map Pilgrimage Payments
        (pilgrimagePayments || []).forEach(p => {
            const tripTitle = (p.bookings as any)?.pilgrimages?.title || 'Peregrinação';
            transactions.push({
                id: p.id,
                category: 'pilgrimage',
                reference: p.external_reference || `PILG-${p.id.slice(0, 8)}`,
                amount: p.amount,
                currency: 'EUR',
                customer_name: tripTitle, // Using trip title as primary identifier here
                customer_email: p.transaction_id || '—',
                status: p.status,
                method: p.method,
                provider: p.method === 'manual' ? 'Manual' : 'Online',
                created_at: p.created_at,
                proof_url: p.proof_url,
                notes: p.notes,
                details_link: `/admin/peregrinacoes`
            });
        });

        // Map Quota Payments
        (quotaPayments || []).forEach(q => {
            transactions.push({
                id: q.id,
                category: 'quota',
                reference: q.external_reference || `QUOTA-${q.id.slice(0, 8)}`,
                amount: q.valor,
                currency: 'EUR',
                customer_name: (q.membros as any)?.nome || 'Membro',
                customer_email: (q.membros as any)?.email || '—',
                status: q.estado,
                method: q.metodo_pagamento,
                provider: q.metodo_pagamento === 'stripe' ? 'Stripe' : 'Manual',
                created_at: q.data_pagamento + 'T12:00:00Z', // Date only to ISO
                details_link: `/admin/membros`
            });
        });

        // Sort globally by date
        transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return NextResponse.json({ transactions });

    } catch (error) {
        console.error("Consolidated API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
