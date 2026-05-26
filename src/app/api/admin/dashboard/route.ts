import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { startOfMonth, subDays, format, differenceInDays, sub } from 'date-fns';
import { verifyAdmin } from '../../../../lib/admin-auth';

export const dynamic = 'force-dynamic';

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

        // --- 1. DATE RANGE LOGIC ---
        const now = new Date();
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');

        // Defaults to last 30 days if not specified
        const currentEnd = toParam ? new Date(toParam) : now;
        const currentStart = fromParam ? new Date(fromParam) : subDays(now, 30);

        // Calculate Previous Period (Same Duration, Immediately Preceding)
        const durationDays = Math.max(1, differenceInDays(currentEnd, currentStart));
        const prevEnd = subDays(currentStart, 1);
        const prevStart = subDays(prevEnd, durationDays);

        // 1. DATA SOURCE FETCHING
        // Helper to safe fetch but LOG errors
        const safeQuery = async (params: any) => {
            const { data, error } = await params;
            if (error) {
                console.error("Dashboard DB Error:", error);
                return [];
            }
            return data || [];
        };

        const fetchStart = prevStart;
        const fetchEnd = currentEnd;

        // Fetch Orders FIRST
        const orders = await safeQuery(
            supabaseServer.from('store_orders')
                .select('total_amount, created_at, id, buyer_name, status, order_ref')
                .in('status', ['paid', 'succeeded', 'delivered'])
                .gte('created_at', fetchStart.toISOString())
                .lte('created_at', fetchEnd.toISOString())
        );

        // Fetch Items separate (to avoid FK/embedding issues)
        const orderRefs = orders.map((o: any) => o.order_ref).filter(Boolean);
        let orderItems: any[] = [];

        if (orderRefs.length > 0) {
            // Fetch in chunks if needed or just all (limit to sane amount if necessary)
            const { data: itemsData, error: itemsErr } = await supabaseServer
                .from('store_order_items')
                .select('name, qty, unit_price, order_ref')
                .in('order_ref', orderRefs);

            if (itemsErr) console.error("Error fetching order items:", itemsErr);
            else orderItems = itemsData || [];
        }

        const [donationsRaw, pilgrimPaymentsRaw, quotasRaw, lowStockRaw] = await Promise.all([
            // Donations — `donation_status` is an enum that only allows: pending,
            // processing, succeeded, failed, canceled, pending_verification.
            // Passing values outside the enum invalidates the whole query, which is
            // why donations used to show as €0 on the chart.
            supabaseServer.from('donations')
                .select('amount_cents, created_at, status, donor_name, donor_email, user_id')
                .eq('status', 'succeeded')
                .gte('created_at', fetchStart.toISOString())
                .lte('created_at', fetchEnd.toISOString()),

            // Pilgrimages — include 'manual' (admin-recorded payments) so the chart is complete.
            supabaseServer.from('pilgrimage_payments')
                .select('amount, created_at, status, user_id, booking_id, booking:bookings(id, user_id, pilgrims(full_name), pilgrimage:pilgrimages(title))')
                .in('status', ['succeeded', 'verified', 'paid', 'manual'])
                .gte('created_at', fetchStart.toISOString())
                .lte('created_at', fetchEnd.toISOString()),

            // Quotas — fetch raw rows; we'll join names via an in-memory member lookup below.
            supabaseServer.from('pagamentos_quotas')
                .select('valor, data_pagamento, estado, user_id')
                .in('estado', ['pago', 'paid'])
                .gte('data_pagamento', fetchStart.toISOString())
                .lte('data_pagamento', fetchEnd.toISOString()),

            // Low Stock
            supabaseServer.from('store_products')
                .select('id, name, stock')
                .lt('stock', 10)
                .order('stock', { ascending: true })
                .limit(5)
        ]);

        const donations = donationsRaw.data || [];
        const pilgrimPayments = pilgrimPaymentsRaw.data || [];
        const quotas = quotasRaw.data || [];
        const lowStock = lowStockRaw.data || [];

        // Build a single member lookup keyed by user_id so we can resolve names
        // for donations, pilgrimage payments and quotas without ambiguous PostgREST joins.
        const memberUserIds = new Set<string>();
        for (const d of donations) if (d?.user_id) memberUserIds.add(String(d.user_id));
        for (const p of pilgrimPayments) {
            if (p?.user_id) memberUserIds.add(String(p.user_id));
            const bookingUser = (p as any)?.booking?.user_id;
            if (bookingUser) memberUserIds.add(String(bookingUser));
        }
        for (const q of quotas) if (q?.user_id) memberUserIds.add(String(q.user_id));

        const memberById = new Map<string, { nome: string | null; email: string | null }>();
        if (memberUserIds.size > 0) {
            const { data: membersData } = await supabaseServer
                .from('membros')
                .select('id, nome, email')
                .in('id', Array.from(memberUserIds));
            for (const m of (membersData || []) as Array<{ id: string; nome: string | null; email: string | null }>) {
                memberById.set(String(m.id), { nome: m.nome, email: m.email });
            }
        }

        const resolveDonationName = (d: any): string => {
            const name = String(d?.donor_name || '').trim();
            if (name) return name;
            const memberMatch = d?.user_id ? memberById.get(String(d.user_id)) : null;
            if (memberMatch?.nome) return memberMatch.nome;
            if (memberMatch?.email) return memberMatch.email;
            return String(d?.donor_email || '').trim() || 'Doador anónimo';
        };

        const resolvePilgrimName = (p: any): string => {
            // 1. Try the first pilgrim's full_name on the booking
            const pilgrims = p?.booking?.pilgrims;
            if (Array.isArray(pilgrims)) {
                const firstName = pilgrims
                    .map((x: any) => String(x?.full_name || '').trim())
                    .find(Boolean);
                if (firstName) return firstName;
            }
            // 2. Fall back to the booking owner / payer's member name
            const ownerId = p?.user_id || p?.booking?.user_id;
            const memberMatch = ownerId ? memberById.get(String(ownerId)) : null;
            if (memberMatch?.nome) return memberMatch.nome;
            if (memberMatch?.email) return memberMatch.email;
            return 'Peregrino';
        };

        const resolveQuotaName = (q: any): string => {
            const memberMatch = q?.user_id ? memberById.get(String(q.user_id)) : null;
            if (memberMatch?.nome) return memberMatch.nome;
            if (memberMatch?.email) return memberMatch.email;
            return 'Membro';
        };

        // --- 3. HELPER FUNCTIONS ---
        const parseDate = (item: any) => {
            if (item.data_pagamento) return new Date(item.data_pagamento);
            if (item.created_at) return new Date(item.created_at);
            return new Date();
        };

        const getRevenue = (item: any, type: string) => {
            if (type === 'donation') return (Number(item.amount_cents) || 0) / 100;
            if (type === 'order') return Number(item.total_amount) || 0;
            if (type === 'pilgrimage') return Number(item.amount) || 0;
            if (type === 'quota') return Number(item.valor) || 0;
            return 0;
        };

        const isInPeriod = (date: Date, start: Date, end: Date) => date >= start && date <= end;

        // --- 4. DATA PROCESSING ---
        let currentRev = 0, prevRev = 0;
        let currentOrders = 0, prevOrders = 0;
        let currentDonations = 0, prevDonations = 0;

        // Buckets for Graphs
        const dailyData: Record<string, { date: string, store: number, donations: number, pilgrimages: number, quotas: number }> = {};

        for (let i = 0; i <= durationDays; i++) {
            const d = subDays(currentEnd, i);
            if (d < currentStart) break;
            const dayStr = format(d, 'yyyy-MM-dd');
            dailyData[dayStr] = { date: dayStr, store: 0, donations: 0, pilgrimages: 0, quotas: 0 };
        }

        // Top Lists Buckets
        const productsMap: Record<string, { name: string, rev: number, qty: number }> = {};
        const pilgrimagesMap: Record<string, { name: string, rev: number }> = {};

        // Process Donations
        for (const item of donations) {
            const date = parseDate(item);
            const amount = getRevenue(item, 'donation');

            if (isInPeriod(date, currentStart, currentEnd)) {
                currentRev += amount;
                currentDonations += amount;
                const dayStr = format(date, 'yyyy-MM-dd');
                if (dailyData[dayStr]) dailyData[dayStr].donations += amount;
            } else if (isInPeriod(date, prevStart, prevEnd)) {
                prevRev += amount;
                prevDonations += amount;
            }
        }

        // Process Orders
        // Enhance orders with items manually
        const ordersWithItems = orders.map((o: any) => ({
            ...o,
            items: orderItems.filter((i: any) => i.order_ref === o.order_ref)
        }));

        for (const item of ordersWithItems) {
            const date = parseDate(item);
            const amount = getRevenue(item, 'order');

            if (isInPeriod(date, currentStart, currentEnd)) {
                currentRev += amount;
                currentOrders++;
                const dayStr = format(date, 'yyyy-MM-dd');
                if (dailyData[dayStr]) dailyData[dayStr].store += amount;

                // Process Items for Top Products
                if (item.items) {
                    item.items.forEach((p: any) => {
                        const name = p.name || 'Produto sem nome';
                        if (!productsMap[name]) productsMap[name] = { name, rev: 0, qty: 0 };
                        productsMap[name].rev += (Number(p.unit_price) * Number(p.qty));
                        productsMap[name].qty += Number(p.qty);
                    });
                }

            } else if (isInPeriod(date, prevStart, prevEnd)) {
                prevRev += amount;
                prevOrders++;
            }
        }

        // Process Pilgrimages
        for (const item of pilgrimPayments) {
            const date = parseDate(item);
            const amount = getRevenue(item, 'pilgrimage');

            if (isInPeriod(date, currentStart, currentEnd)) {
                currentRev += amount;
                const dayStr = format(date, 'yyyy-MM-dd');
                if (dailyData[dayStr]) dailyData[dayStr].pilgrimages += amount;

                // Process Name for Top Pilgrimages
                // @ts-ignore
                const title = item.booking?.pilgrimage?.title || 'Pagamento Avulso';
                if (!pilgrimagesMap[title]) pilgrimagesMap[title] = { name: title, rev: 0 };
                pilgrimagesMap[title].rev += amount;

            } else if (isInPeriod(date, prevStart, prevEnd)) {
                prevRev += amount;
            }
        }

        // Process Quotas
        for (const item of quotas) {
            const date = parseDate(item);
            const amount = getRevenue(item, 'quota');

            if (isInPeriod(date, currentStart, currentEnd)) {
                currentRev += amount;
                const dayStr = format(date, 'yyyy-MM-dd');
                if (dailyData[dayStr]) dailyData[dayStr].quotas += amount;
            } else if (isInPeriod(date, prevStart, prevEnd)) {
                prevRev += amount;
            }
        }

        // --- 5. CALCULATE TRENDS ---
        const calcTrend = (curr: number, prev: number) => {
            if (prev === 0) return curr === 0 ? 0 : 100;
            return ((curr - prev) / prev) * 100;
        };

        const revenueTrend = calcTrend(currentRev, prevRev);
        const ordersTrend = calcTrend(currentOrders, prevOrders);
        const donationsTrend = calcTrend(currentDonations, prevDonations);
        const aov = currentOrders > 0 ? (currentRev / currentOrders) : 0;

        // --- 6. FORMAT OUTPUT ---

        // Sort Daily Data
        const chartData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

        // Sort Top Lists
        const topProducts = Object.values(productsMap)
            .sort((a, b) => b.rev - a.rev)
            .slice(0, 5);

        const topPilgrimages = Object.values(pilgrimagesMap)
            .sort((a, b) => b.rev - a.rev)
            .slice(0, 5);

        // Recent Transactions — the frontend expects `customer_name`, so resolve real
        // names for each source via the in-memory member lookup. Quotas are also
        // included now so the activity feed reflects every revenue stream.
        const recentMerged = [
            ...orders
                .filter((i: any) => isInPeriod(parseDate(i), currentStart, currentEnd))
                .map((i: any) => ({
                    type: 'shop',
                    amount: getRevenue(i, 'order'),
                    label: 'Loja',
                    customer_name: String(i.buyer_name || '').trim() || 'Cliente sem nome',
                    status: i.status,
                    date: parseDate(i),
                })),
            ...donations
                .filter((i: any) => isInPeriod(parseDate(i), currentStart, currentEnd))
                .map((i: any) => ({
                    type: 'donation',
                    amount: getRevenue(i, 'donation'),
                    label: 'Doação',
                    customer_name: resolveDonationName(i),
                    status: i.status,
                    date: parseDate(i),
                })),
            ...pilgrimPayments
                .filter((i: any) => isInPeriod(parseDate(i), currentStart, currentEnd))
                .map((i: any) => ({
                    type: 'booking',
                    amount: getRevenue(i, 'pilgrimage'),
                    label: 'Peregrinação',
                    customer_name: resolvePilgrimName(i),
                    status: i.status,
                    date: parseDate(i),
                })),
            ...quotas
                .filter((i: any) => isInPeriod(parseDate(i), currentStart, currentEnd))
                .map((i: any) => ({
                    type: 'quota',
                    amount: getRevenue(i, 'quota'),
                    label: 'Anuidade',
                    customer_name: resolveQuotaName(i),
                    status: i.estado,
                    date: parseDate(i),
                })),
        ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);

        return NextResponse.json({
            kpi: {
                revenue: { value: currentRev, trend: revenueTrend, prev: prevRev },
                orders: { value: currentOrders, trend: ordersTrend, prev: prevOrders },
                donations: { value: currentDonations, trend: donationsTrend, prev: prevDonations },
                aov: { value: aov, trend: 0 }
            },
            charts: {
                revenueOverTime: chartData,
                revenueDistribution: [
                    { name: 'Loja', value: chartData.reduce((a, b) => a + b.store, 0) },
                    { name: 'Doações', value: chartData.reduce((a, b) => a + b.donations, 0) },
                    { name: 'Peregrinações', value: chartData.reduce((a, b) => a + b.pilgrimages, 0) },
                    { name: 'Quotas', value: chartData.reduce((a, b) => a + b.quotas, 0) },
                ].filter(x => x.value > 0)
            },
            tables: {
                topProducts,
                topPilgrimages,
                recentTransactions: recentMerged,
                lowStock
            },
            meta: {
                from: currentStart,
                to: currentEnd,
                prevFrom: prevStart,
                prevTo: prevEnd
            }
        });

    } catch (error: any) {
        console.error("Dashboard CRITICAL API Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
