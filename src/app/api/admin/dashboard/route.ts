import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { startOfMonth, subDays, format, differenceInDays, sub } from 'date-fns';

// Helper to validate Admin Session
const isAdmin = async (req: Request) => {
    if (!supabaseServer) return false;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return false;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseServer.auth.getUser(token);
    return !error && !!user;
};

export async function GET(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ error: 'Database Config Error' }, { status: 500 });
    }

    if (!await isAdmin(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
            // Donations
            supabaseServer.from('donations')
                .select('amount_cents, created_at, status')
                .in('status', ['succeeded', 'pago', 'verified'])
                .gte('created_at', fetchStart.toISOString())
                .lte('created_at', fetchEnd.toISOString()),

            // Pilgrimages
            supabaseServer.from('pilgrimage_payments')
                .select('amount, created_at, status, booking:bookings(pilgrimage:pilgrimages(title))')
                .in('status', ['succeeded', 'verified', 'paid'])
                .gte('created_at', fetchStart.toISOString())
                .lte('created_at', fetchEnd.toISOString()),

            // Quotas
            supabaseServer.from('pagamentos_quotas')
                .select('valor, data_pagamento, estado')
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

        // Recent Transactions
        const recentMerged = [
            ...orders.filter((i: any) => isInPeriod(parseDate(i), currentStart, currentEnd)).map((i: any) => ({ ...i, type: 'shop', amount: getRevenue(i, 'order'), label: 'Loja', customer: i.buyer_name, date: parseDate(i) })),
            ...donations.filter((i: any) => isInPeriod(parseDate(i), currentStart, currentEnd)).map((i: any) => ({ ...i, type: 'donation', amount: getRevenue(i, 'donation'), label: 'Doação', customer: 'Doador', date: parseDate(i) })),
            ...pilgrimPayments.filter((i: any) => isInPeriod(parseDate(i), currentStart, currentEnd)).map((i: any) => ({ ...i, type: 'booking', amount: getRevenue(i, 'pilgrimage'), label: 'Peregrinação', customer: 'Peregrino', date: parseDate(i) })),
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
