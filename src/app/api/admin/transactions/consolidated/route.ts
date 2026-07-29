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
            .select('id, booking_id, amount, method, status, receipt_url, proof_url, transaction_id, payment_intent_id, created_at, external_reference, notes, invoice_sent_at, bookings(id, user_id, pilgrimages(title, start_date, end_date))')
            .not('deleted', 'is', true)
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
        // Resolve the true provider. For donations, the authoritative source is metadata.provider
        // because the `method` enum only allows stripe_card/bank_transfer/pix, so Reduniq donations
        // are persisted as method='stripe_card'.
        const resolveProvider = (category: string, method?: string | null, metadataProvider?: string | null): string => {
            const m = String(method || '').toLowerCase();
            const mp = String(metadataProvider || '').toLowerCase();
            if (mp === 'reduniq' || m.includes('reduniq') || m.includes('mbway') || m.includes('multibanco')) return 'Reduniq';
            if (mp === 'stripe' || m.includes('stripe')) return 'Stripe';
            if (m.includes('bank') || m.includes('transfer') || m.includes('deposito') || m.includes('depósito')) return 'Transferência';
            if (m.includes('manual')) return 'Manual';
            if (m === 'pix' || m.includes('pix')) return 'Pix';
            if (m.includes('paypal')) return 'Paypal';
            if (category === 'shop') return 'Loja';
            if (category === 'donation') return 'Doação';
            if (category === 'quota') return 'Quota';
            if (category === 'pilgrimage') return 'Peregrinação';
            return '—';
        };

        const clean = (value: unknown): string | null => {
            const s = typeof value === 'string' ? value.trim() : '';
            return s.length > 0 ? s : null;
        };

        // "Tipo: deposit" / "Tipo: full" is appended to pilgrimage_payments.notes by the checkout route.
        const pilgrimagePaymentKind = (notes?: string | null): string | null => {
            const match = /Tipo:\s*([a-z_]+)/i.exec(String(notes || ''));
            if (!match) return null;
            switch (match[1].toLowerCase()) {
                case 'deposit': return 'Sinal';
                case 'full': return 'Pagamento total';
                case 'installment': return 'Prestação';
                case 'balance': return 'Valor restante';
                default: return match[1];
            }
        };

        // O `amount` guardado é o valor base; o Reduniq cobra base + taxa. O total efetivamente
        // cobrado só existe na nota ("Total cobrado: 1019.00€"), e é esse que aparece no backoffice.
        const chargedAmountFromNotes = (notes?: string | null): number | null => {
            const match = /Total cobrado:\s*([\d.,]+)/i.exec(String(notes || ''));
            if (!match) return null;
            const value = Number(match[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
            return Number.isFinite(value) && value > 0 ? value : null;
        };

        // A "description" enviada ao Reduniq no initPayment não é persistida — é construída no
        // checkout. Reproduzimos aqui a mesma fórmula para o admin poder casar a linha com o que
        // vê no backoffice. Só faz sentido em pagamentos que passaram mesmo pelo gateway.
        const gatewayDescription = (provider: string, category: string, row: any): string | null => {
            if (provider !== 'Reduniq') return null;
            switch (category) {
                case 'pilgrimage':
                    // src/app/api/payments/checkout/route.ts → `Peregrinacao ${booking.id.slice(0,8)}`
                    return row.booking_id ? `Peregrinacao ${String(row.booking_id).slice(0, 8)}` : null;
                case 'shop':
                    // src/app/api/store/checkout/route.ts → `Loja Online - Pedido ${orderRef}`
                    // (checkouts em inglês enviam "Online Store"; a referência é igual nos dois)
                    return row.order_ref ? `Loja Online - Pedido ${row.order_ref}` : null;
                case 'donation':
                    return 'Doação';       // src/lib/payments.ts
                case 'quota':
                    return 'Quota anual';  // src/lib/payments.ts
                default:
                    return null;
            }
        };

        const yearFrom = (value?: string | null): string | null => {
            const year = String(value || '').slice(0, 4);
            return /^\d{4}$/.test(year) ? year : null;
        };

        // Consolidate Data
        const transactions: any[] = [];

        // Map Donations
        (donations || []).forEach(d => {
            const donationProvider = resolveProvider('donation', d.method, (d.metadata as any)?.provider);
            transactions.push({
                gateway_description: gatewayDescription(donationProvider, 'donation', d),
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
                provider: donationProvider,
                created_at: d.created_at,
                invoice_sent_at: d.invoice_sent_at,
                has_nif: hasNif(d.donor_nif),
                subject: clean(d.description) || 'Doação',
                subject_detail: null,
                external_reference: clean(d.external_reference),
                gateway_transaction_id: clean((d.metadata as any)?.reduniqTransactionId),
                payment_token: clean(d.payment_intent_id),
                details_link: `/admin/doacoes?id=${d.id}`
            });
        });

        // Map Store Orders
        (orders || []).forEach(o => {
            const storeNif = typeof o.buyer_nif === 'string' ? o.buyer_nif.trim() : '';
            const storeItems = itemsMap.get(o.order_ref) || [];
            const storeProvider = resolveProvider('shop', o.payment_method, o.payment_provider);
            transactions.push({
                gateway_description: gatewayDescription(storeProvider, 'shop', o),
                id: o.id,
                category: 'shop',
                reference: o.order_ref || `SHOP-${o.id.slice(0, 8)}`,
                amount: Number(o.total_amount || 0),
                currency: o.currency || 'EUR',
                customer_name: o.buyer_name || 'Cliente Loja',
                customer_email: o.buyer_email || '—',
                status: o.status,
                method: o.payment_method,
                provider: storeProvider,
                created_at: o.created_at,
                customer_nif: storeNif || null,
                customer_address: o.billing_address || o.shipping_address1,
                customer_city: o.billing_city || o.shipping_city,
                customer_zip: o.billing_postal_code || o.shipping_postal_code,
                customer_country: o.billing_country || o.shipping_country,
                items: storeItems.map((i: any) => ({
                    name: i.name,
                    qty: i.qty,
                    price: Number(i.unit_price || 0),
                    total: Number(i.total_price || (Number(i.unit_price || 0) * Number(i.qty || 1)))
                })),
                invoice_sent_at: o.invoice_sent_at,
                has_nif: hasNif(storeNif),
                subject: storeItems.length > 0
                    ? storeItems.map((i: any) => `${i.qty || 1}x ${i.name}`).join(', ')
                    : 'Encomenda da loja',
                subject_detail: storeItems.length > 1 ? `${storeItems.length} artigos` : null,
                external_reference: clean(o.order_ref),
                // A Reduniq não devolve o id de transação para encomendas da loja neste fluxo;
                // só o token de pagamento fica persistido em store_orders.payment_reference.
                gateway_transaction_id: null,
                payment_token: clean(o.payment_reference),
                details_link: `/admin/loja?order=${o.id}`
            });
        });

        // Map Pilgrimage Payments
        (pilgrimagePayments || []).forEach(p => {
            const trip = (p.bookings as any)?.pilgrimages;
            const tripTitle = clean(trip?.title);
            const userId = (p.bookings as any)?.user_id;
            const bookingId = (p as any).booking_id as string | undefined;
            const profile = profilesMap.get(userId);
            const bookingNif = (bookingId ? bookingNifMap.get(bookingId) : null) || null;
            const resolvedNif = (typeof profile?.nif === 'string' && profile.nif.trim()) || bookingNif || null;

            // Resolve customer name: member profile > pilgrim name.
            // Never fall back to the trip title — a viagem não é a entidade que pagou.
            const resolvedName = profile?.nome
                || (bookingId ? bookingNameMap.get(bookingId) : null)
                || 'Peregrino sem perfil';

            // Resolve customer email: member profile > pilgrim email.
            const resolvedEmail = profile?.email
                || (bookingId ? bookingEmailMap.get(bookingId) : null)
                || '—';

            // Qual peregrinação + que parcela do pagamento (sinal / total / prestação).
            const tripYear = yearFrom(trip?.start_date);
            const kind = pilgrimagePaymentKind(p.notes);
            const pilgrimageProvider = resolveProvider('pilgrimage', p.method, null);

            transactions.push({
                gateway_description: gatewayDescription(pilgrimageProvider, 'pilgrimage', p),
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
                provider: pilgrimageProvider,
                created_at: p.created_at,
                proof_url: p.receipt_url || (p as any).proof_url || undefined,
                receipt_url: p.receipt_url,
                notes: p.notes,
                invoice_sent_at: p.invoice_sent_at,
                has_nif: hasNif(resolvedNif),
                subject: tripTitle
                    ? (tripYear && !tripTitle.includes(tripYear) ? `${tripTitle} (${tripYear})` : tripTitle)
                    : 'Peregrinação (viagem não identificada)',
                subject_detail: kind,
                charged_amount: chargedAmountFromNotes(p.notes),
                external_reference: clean(p.external_reference),
                gateway_transaction_id: clean(p.transaction_id),
                payment_token: clean((p as any).payment_intent_id),
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
                : new Date(0).toISOString();

            // Quotas importadas do sistema antigo têm data_pagamento = 1 de Janeiro do ano que a
            // quota cobre, não a data real em que o dinheiro entrou. Quem paga adiantado fica com
            // uma linha datada no futuro. Marcamos para o admin não a ler como data de pagamento.
            const isLegacyImport = String(q.external_reference || '').startsWith('legacy_quota:')
                || String(q.payment_intent_id || '').startsWith('legacy_import:');

            const quotaProvider = resolveProvider('quota', q.metodo_pagamento, null);

            transactions.push({
                gateway_description: gatewayDescription(quotaProvider, 'quota', q),
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
                provider: quotaProvider,
                created_at: quotaCreatedAt,
                invoice_sent_at: q.invoice_sent_at,
                has_nif: hasNif(quotaNif),
                subject: `Quota de membro${yearFrom(q.data_pagamento) ? ` ${yearFrom(q.data_pagamento)}` : ''}`,
                subject_detail: isLegacyImport ? 'Importação legacy' : null,
                date_is_approximate: isLegacyImport,
                external_reference: clean(q.external_reference),
                // Idem loja: pagamentos_quotas só guarda o token, não o id de transação Reduniq.
                gateway_transaction_id: null,
                payment_token: clean(q.payment_intent_id),
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
