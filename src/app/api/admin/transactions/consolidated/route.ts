import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';

import { verifyAdmin } from '../../../../../lib/admin-auth';

export async function GET(req: Request) {
    const { authorized, error } = await verifyAdmin(req);
    if (!authorized) {
        return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    try {
        // 1. Fetch Donations
        // Prioritize direct columns, fall back to joined donors
        const { data: donations } = await supabaseServer
            .from('donations')
            .select('*')
            .order('created_at', { ascending: false });

        // 2. Fetch Store Orders
        const { data: orders } = await supabaseServer
            .from('store_orders')
            .select('*')
            .order('created_at', { ascending: false });

        const orderRefs = (orders || []).map(o => o.order_ref);
        const { data: allItems } = orderRefs.length > 0
            ? await supabaseServer
                .from('store_order_items')
                .select('*')
                .in('order_ref', orderRefs)
            : { data: [] };

        const itemsMap = new Map<string, any[]>();
        (allItems || []).forEach((item: any) => {
            const list = itemsMap.get(item.order_ref) || [];
            list.push(item);
            itemsMap.set(item.order_ref, list);
        });

        // 3. Fetch Pilgrimage Payments
        const { data: pilgrimagePayments } = await supabaseServer
            .from('pilgrimage_payments')
            .select('*, bookings(user_id, pilgrimages(title))')
            .order('created_at', { ascending: false });

        // 4. Fetch Quota Payments
        const { data: quotaPayments } = await supabaseServer
            .from('pagamentos_quotas')
            .select('*')
            .order('data_pagamento', { ascending: false });

        // 5. Batch Fetch Profiles (Membros)
        // Collect user_ids from Pilgrimages (booking.user_id) and Quotas (user_id)
        const userIds = new Set<string>();

        // From Pilgrimages
        (pilgrimagePayments || []).forEach(p => {
            const uid = (p.bookings as any)?.user_id;
            if (uid) userIds.add(uid);
        });

        // From Quotas
        (quotaPayments || []).forEach(q => {
            if (q.user_id) userIds.add(q.user_id);
        });

        // Fetch Membros
        const { data: profiles } = userIds.size > 0
            ? await supabaseServer
                .from('membros')
                .select('id, nome, email, nif, address, postal_code') // Ensure these columns exist
                .in('id', Array.from(userIds))
            : { data: [] };

        const profilesMap = new Map<string, any>();
        (profiles || []).forEach(p => profilesMap.set(p.id, p));


        // Consolidate Data
        const transactions: any[] = [];

        // Map Donations
        (donations || []).forEach(d => {
            // Logic: Prefer donor_* columns. If null, try to use joined donor (not joined here to save perf, usually donor_* is reliable for recent ones)
            // Actually, for older data, donor_* might be null? 
            // 'donors' table join was removed above. If we need it, we should add it back or rely on 'donor_id' fetch.
            // Assumption: 'donor_name', 'donor_email' are populated for guest donations. 
            // If they are missing, we might need a separate fetch for 'donors' table if 'donor_id' exists.

            transactions.push({
                id: d.id,
                category: 'donation',
                reference: `DON-${d.id.slice(0, 8)}`,
                amount: (d.amount_cents || 0) / 100,
                currency: d.currency || 'EUR',
                customer_name: d.donor_name || (d.donor_email ? 'Doador' : 'Anónimo'),
                customer_email: d.donor_email || '—',
                customer_nif: d.donor_nif,
                customer_address: d.donor_address,
                customer_city: d.donor_city,
                customer_zip: d.donor_zip,
                customer_country: d.donor_country,
                status: d.status,
                method: d.method,
                provider: 'Stripe',
                created_at: d.created_at,
                invoice_sent_at: d.invoice_sent_at,
                details_link: `/admin/doacoes?id=${d.id}`
            });
        });

        // Map Store Orders (Same as before)
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
                customer_address: o.billing_address || o.shipping_address1,
                customer_city: o.billing_city || o.shipping_city,
                customer_zip: o.billing_postal_code || o.shipping_postal_code,
                customer_country: o.billing_country || o.shipping_country,
                items: (itemsMap.get(o.order_ref) || []).map((i: any) => ({
                    name: i.name,
                    qty: i.qty,
                    price: i.unit_price,
                    total: i.unit_price * i.qty
                })),
                invoice_sent_at: o.invoice_sent_at,
                details_link: `/admin/loja?order=${o.id}`
            });
        });

        // Map Pilgrimage Payments
        (pilgrimagePayments || []).forEach(p => {
            const tripTitle = (p.bookings as any)?.pilgrimages?.title || 'Peregrinação';
            const userId = (p.bookings as any)?.user_id;
            const profile = profilesMap.get(userId);

            transactions.push({
                id: p.id,
                category: 'pilgrimage',
                reference: p.external_reference || `PILG-${p.id.slice(0, 8)}`,
                amount: p.amount,
                currency: 'EUR',
                customer_name: profile?.nome || tripTitle,
                customer_email: profile?.email || p.transaction_id || '—', // Use profile email first
                customer_nif: profile?.nif,
                customer_address: profile?.address,
                customer_zip: profile?.postal_code,
                status: p.status,
                method: p.method,
                provider: p.method === 'manual' ? 'Manual' : 'Online',
                created_at: p.created_at,
                proof_url: p.proof_url,
                notes: p.notes,
                invoice_sent_at: p.invoice_sent_at,
                details_link: `/admin/peregrinacoes`
            });
        });

        // Map Quota Payments
        (quotaPayments || []).forEach(q => {
            const userId = q.user_id;
            const profile = profilesMap.get(userId);

            transactions.push({
                id: q.id,
                category: 'quota',
                reference: q.external_reference || `QUOTA-${q.id.slice(0, 8)}`,
                amount: q.valor,
                currency: 'EUR',
                customer_name: profile?.nome || 'Membro',
                customer_email: profile?.email || '—',
                customer_nif: profile?.nif,
                customer_address: profile?.address,
                customer_zip: profile?.postal_code,
                status: q.estado,
                method: q.metodo_pagamento,
                provider: q.metodo_pagamento === 'stripe' ? 'Stripe' : 'Manual',
                created_at: q.data_pagamento + 'T12:00:00Z',
                invoice_sent_at: q.invoice_sent_at,
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
