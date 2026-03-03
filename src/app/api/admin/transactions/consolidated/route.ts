import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';

import { verifyAdmin } from '../../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

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
        const { data: donations } = await supabaseServer
            .from('donations')
            .select('*')
            .order('created_at', { ascending: false });

        // 2. Fetch Store Orders
        const { data: orders } = await supabaseServer
            .from('store_orders')
            .select('*')
            .order('created_at', { ascending: false });

        const orderRefs = (orders || [])
            .map(o => (typeof o.order_ref === 'string' ? o.order_ref : null))
            .filter((ref): ref is string => !!ref);
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

        // 3. Fetch Pilgrimage Payments (receipt_url is the correct column name)
        const { data: pilgrimagePayments } = await supabaseServer
            .from('pilgrimage_payments')
            .select('id, booking_id, amount, method, status, receipt_url, transaction_id, created_at, external_reference, notes, invoice_sent_at, bookings(id, user_id, pilgrimages(title))')
            .order('created_at', { ascending: false });

        // 4. Fetch Quota Payments
        const { data: quotaPayments } = await supabaseServer
            .from('pagamentos_quotas')
            .select('*')
            .order('data_pagamento', { ascending: false });

        // 5. Batch Fetch Profiles (Membros)
        const userIds = new Set<string>();
        const bookingIds = new Set<string>();

        (pilgrimagePayments || []).forEach(p => {
            if ((p as any)?.booking_id) bookingIds.add((p as any).booking_id);
            const uid = (p.bookings as any)?.user_id;
            if (uid) userIds.add(uid);
        });

        (quotaPayments || []).forEach(q => {
            if (q.user_id) userIds.add(q.user_id);
        });

        const { data: profiles } = userIds.size > 0
            ? await supabaseServer
                .from('membros')
                .select('id, nome, email, nif, address, postal_code')
                .in('id', Array.from(userIds))
            : { data: [] };

        const profilesMap = new Map<string, any>();
        (profiles || []).forEach(p => profilesMap.set(p.id, p));

        // Fetch pilgrims to get NIF where member profile is missing
        const { data: pilgrimsByBooking } = bookingIds.size > 0
            ? await supabaseServer
                .from('pilgrims')
                .select('booking_id, full_name, email, cpf_nif')
                .in('booking_id', Array.from(bookingIds))
            : { data: [] };

        const bookingNifMap = new Map<string, string | null>();
        const bookingNameMap = new Map<string, string>();
        const bookingEmailMap = new Map<string, string>();

        (pilgrimsByBooking || []).forEach((row: any) => {
            const bookingId = row?.booking_id as string | undefined;
            if (!bookingId) return;
            // Only store the first pilgrim per booking (the lead pilgrim)
            if (!bookingNifMap.has(bookingId)) {
                const nif = typeof row?.cpf_nif === 'string' ? row.cpf_nif.trim() : '';
                if (nif) bookingNifMap.set(bookingId, nif);
            }
            if (!bookingNameMap.has(bookingId) && row?.full_name) {
                bookingNameMap.set(bookingId, row.full_name);
            }
            if (!bookingEmailMap.has(bookingId) && row?.email) {
                bookingEmailMap.set(bookingId, row.email);
            }
        });

        // Fallback: For any user_id that still doesn't have an email in profilesMap, fetch directly from auth
        const missingAuthUsers = Array.from(userIds).filter(uid => !profilesMap.get(uid)?.email);
        if (missingAuthUsers.length > 0) {
            await Promise.all(missingAuthUsers.map(async (uid) => {
                try {
                    const { data: authData } = await supabaseServer!.auth.admin.getUserById(uid);
                    if (authData?.user?.email) {
                        const existing = profilesMap.get(uid) || {};
                        profilesMap.set(uid, { ...existing, email: authData.user.email });
                    }
                } catch (e) {
                    console.warn(`Could not fetch auth user ${uid}`, e);
                }
            }));
        }

        const hasNif = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
        const normalizeProvider = (category: string, method?: string | null) => {
            const m = String(method || '').toLowerCase();
            if (category === 'shop') return m.includes('reduniq') ? 'Reduniq' : m.includes('stripe') ? 'Stripe' : 'Loja';
            if (category === 'donation') return m.includes('reduniq') ? 'Reduniq' : m.includes('stripe') ? 'Stripe' : m.includes('bank') ? 'Transferência' : 'Doação';
            if (category === 'quota') return m.includes('stripe') ? 'Stripe' : m.includes('manual') ? 'Manual' : 'Quota';
            if (category === 'pilgrimage') return m.includes('reduniq') ? 'Reduniq' : m.includes('stripe') ? 'Stripe' : m.includes('manual') ? 'Manual' : 'Peregrinação';
            return '—';
        };

        // Consolidate Data
        const transactions: any[] = [];

        // Map Donations
        (donations || []).forEach(d => {
            transactions.push({
                id: d.id,
                category: 'donation',
                reference: `DON-${d.id.slice(0, 8)}`,
                amount: typeof d.amount_cents === 'number'
                    ? d.amount_cents / 100
                    : Number(d.amount || 0),
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
                provider: normalizeProvider('donation', d.method),
                created_at: d.created_at,
                invoice_sent_at: d.invoice_sent_at,
                has_nif: hasNif(d.donor_nif),
                details_link: `/admin/doacoes?id=${d.id}`
            });
        });

        // Map Store Orders
        (orders || []).forEach(o => {
            const storeNif = typeof o.buyer_nif === 'string' ? o.buyer_nif.trim() : '';
            transactions.push({
                id: o.id,
                category: 'shop',
                reference: o.order_ref || `SHOP-${o.id.slice(0, 8)}`,
                amount: Number(o.total_amount || 0),
                currency: o.currency || 'EUR',
                customer_name: o.buyer_name || 'Cliente Loja',
                customer_email: o.buyer_email || '—',
                status: o.status,
                method: o.payment_method,
                provider: normalizeProvider('shop', o.payment_method),
                created_at: o.created_at,
                customer_nif: storeNif || null,
                customer_address: o.billing_address || o.shipping_address1,
                customer_city: o.billing_city || o.shipping_city,
                customer_zip: o.billing_postal_code || o.shipping_postal_code,
                customer_country: o.billing_country || o.shipping_country,
                items: (itemsMap.get(o.order_ref) || []).map((i: any) => ({
                    name: i.name,
                    qty: i.qty,
                    price: Number(i.unit_price || 0),
                    total: Number(i.total_price || (Number(i.unit_price || 0) * Number(i.qty || 1)))
                })),
                invoice_sent_at: o.invoice_sent_at,
                has_nif: hasNif(storeNif),
                details_link: `/admin/loja?order=${o.id}`
            });
        });

        // Map Pilgrimage Payments
        (pilgrimagePayments || []).forEach(p => {
            const tripTitle = (p.bookings as any)?.pilgrimages?.title || 'Peregrinação';
            const userId = (p.bookings as any)?.user_id;
            const bookingId = (p as any).booking_id as string | undefined;
            const profile = profilesMap.get(userId);
            const bookingNif = (bookingId ? bookingNifMap.get(bookingId) : null) || null;
            const resolvedNif = (typeof profile?.nif === 'string' && profile.nif.trim()) || bookingNif || null;

            // Resolve customer name: member profile > pilgrim name > pilgrimage title
            const resolvedName = profile?.nome
                || (bookingId ? bookingNameMap.get(bookingId) : null)
                || tripTitle;

            // Resolve customer email: member profile > pilgrim email > transaction_id fallback > dash
            const resolvedEmail = profile?.email
                || (bookingId ? bookingEmailMap.get(bookingId) : null)
                || p.transaction_id
                || '—';

            transactions.push({
                id: p.id,
                category: 'pilgrimage',
                reference: p.external_reference || `PILG-${p.id.slice(0, 8)}`,
                amount: Number(p.amount || 0),
                currency: 'EUR',
                customer_name: resolvedName,
                customer_email: resolvedEmail,
                customer_nif: resolvedNif,
                customer_address: profile?.address,
                customer_zip: profile?.postal_code,
                status: p.status,
                method: p.method,
                provider: normalizeProvider('pilgrimage', p.method),
                created_at: p.created_at,
                receipt_url: p.receipt_url,
                notes: p.notes,
                invoice_sent_at: p.invoice_sent_at,
                has_nif: hasNif(resolvedNif),
                details_link: '/admin/peregrinacoes'
            });
        });

        // Map Quota Payments
        (quotaPayments || []).forEach(q => {
            const userId = q.user_id;
            const profile = profilesMap.get(userId);
            const quotaNif = typeof profile?.nif === 'string' ? profile.nif.trim() : '';

            const quotaCreatedAt = q.data_pagamento
                ? `${q.data_pagamento}T12:00:00Z`
                : q.created_at || new Date(0).toISOString();

            transactions.push({
                id: q.id,
                category: 'quota',
                reference: q.external_reference || `QUOTA-${q.id.slice(0, 8)}`,
                amount: Number(q.valor || 0),
                currency: 'EUR',
                customer_name: profile?.nome || 'Membro',
                customer_email: profile?.email || '—',
                customer_nif: quotaNif || null,
                customer_address: profile?.address,
                customer_zip: profile?.postal_code,
                status: q.estado,
                method: q.metodo_pagamento,
                provider: normalizeProvider('quota', q.metodo_pagamento),
                created_at: quotaCreatedAt,
                invoice_sent_at: q.invoice_sent_at,
                has_nif: hasNif(quotaNif),
                details_link: '/admin/membros'
            });
        });

        // Sort globally by date descending
        transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return NextResponse.json({ transactions });

    } catch (error) {
        console.error('Consolidated API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
