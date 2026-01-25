import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';
import { startOfMonth, subMonths, endOfMonth, format, subDays } from 'date-fns';

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
        const now = new Date();
        const last30Start = subDays(now, 30);
        const prev30Start = subDays(now, 60);

        // Helper for safe fetching
        const safeFetch = async (name: string, promise: Promise<any>) => {
            try {
                const res = await promise;
                if (res.error) throw res.error;
                return res.data || [];
            } catch (e: any) {
                console.error(`Error fetching ${name}:`, e.message);
                return [];
            }
        };

        console.log("Fetching dashboard data (V4 - Columns Fixed)...");

        // 1. DATA SOURCE FETCHING
        const [donationsAll, ordersAll, pilgrimPaymentsAll, quotasAll, lowStock] = await Promise.all([
            // Donations: amount_cents, created_at, status
            safeFetch('donations', supabaseServer
                .from('donations')
                .select('amount_cents, created_at, status')
                .in('status', ['succeeded', 'pago', 'verified']) as any
            ),
            // Store Orders: total_amount, created_at, buyer_name (NOT customer_name), status
            safeFetch('orders', supabaseServer
                .from('store_orders')
                .select('total_amount, created_at, id, buyer_name, status')
                .in('status', ['paid', 'succeeded', 'delivered']) as any
            ),
            // Pilgrimage PAYMENTS (Revenue): amount, created_at, status
            safeFetch('pilgrim_payments', supabaseServer
                .from('pilgrimage_payments')
                .select('amount, created_at, status')
                .in('status', ['succeeded', 'verified', 'paid']) as any
            ),
            // Quotas: valor, data_pagamento (NO created_at), estado
            safeFetch('quotas', supabaseServer
                .from('pagamentos_quotas')
                .select('valor, data_pagamento, estado')
                .in('estado', ['pago', 'paid']) as any
            ),
            // Low Stock
            safeFetch('lowStock', supabaseServer
                .from('store_products')
                .select('id, name, stock')
                .lt('stock', 10)
                .order('stock', { ascending: true })
                .limit(5) as any
            )
        ]);

        console.log(`[DEBUG] Final Counts: Don=${donationsAll.length}, Ord=${ordersAll.length}, PilPay=${pilgrimPaymentsAll.length}, Quot=${quotasAll.length}`);

        // 2. HELPER FUNCTIONS
        const parseDate = (item: any) => {
            if (item.data_pagamento) return new Date(item.data_pagamento);
            if (item.created_at) return new Date(item.created_at);
            return new Date(); // Fallback to now (shouldn't happen with correct queries)
        };

        const getRevenue = (item: any, type: 'donation' | 'order' | 'pilgrimage' | 'quota') => {
            if (type === 'donation') return (Number(item.amount_cents) || 0) / 100;
            if (type === 'order') return Number(item.total_amount) || 0;
            if (type === 'pilgrimage') return Number(item.amount) || 0;
            if (type === 'quota') return Number(item.valor) || 0;
            return 0;
        };

        // 3. KPI CALCS

        // --- Total Revenue (All Time) ---
        const revDonations = donationsAll.reduce((acc: number, i: any) => acc + getRevenue(i, 'donation'), 0);
        const revOrders = ordersAll.reduce((acc: number, i: any) => acc + getRevenue(i, 'order'), 0);
        const revPilgrims = pilgrimPaymentsAll.reduce((acc: number, i: any) => acc + getRevenue(i, 'pilgrimage'), 0);
        const revQuotas = quotasAll.reduce((acc: number, i: any) => acc + getRevenue(i, 'quota'), 0);

        const totalRevenue = revDonations + revOrders + revPilgrims + revQuotas;

        // --- Trends Helpers ---
        const calcTrend = (curr: number, prev: number) => {
            if (prev === 0) return curr === 0 ? 0 : 100;
            return ((curr - prev) / prev) * 100;
        };

        const filterPeriod = (items: any[], start: Date, end: Date) =>
            items.filter(i => {
                const d = parseDate(i);
                return d >= start && d <= end;
            });

        const sumPeriod = (items: any[], start: Date, end: Date, type: 'donation' | 'order' | 'pilgrimage' | 'quota') =>
            filterPeriod(items, start, end).reduce((acc: number, i: any) => acc + getRevenue(i, type), 0);

        // --- Revenue Trend (Last 30 vs Prev 30) ---
        const revLast30 =
            sumPeriod(donationsAll, last30Start, now, 'donation') +
            sumPeriod(ordersAll, last30Start, now, 'order') +
            sumPeriod(pilgrimPaymentsAll, last30Start, now, 'pilgrimage') +
            sumPeriod(quotasAll, last30Start, now, 'quota');

        const revPrev30 =
            sumPeriod(donationsAll, prev30Start, last30Start, 'donation') +
            sumPeriod(ordersAll, prev30Start, last30Start, 'order') +
            sumPeriod(pilgrimPaymentsAll, prev30Start, last30Start, 'pilgrimage') +
            sumPeriod(quotasAll, prev30Start, last30Start, 'quota');

        const revenueTrend = calcTrend(revLast30, revPrev30);

        // --- Orders Trend (Store) ---
        const ordLast30 = filterPeriod(ordersAll, last30Start, now).length;
        const ordPrev30 = filterPeriod(ordersAll, prev30Start, last30Start).length;
        const ordersTrend = calcTrend(ordLast30, ordPrev30);

        // --- Donations Trend ---
        const donLast30 = sumPeriod(donationsAll, last30Start, now, 'donation');
        const donPrev30 = sumPeriod(donationsAll, prev30Start, last30Start, 'donation');
        const donationsTrend = calcTrend(donLast30, donPrev30);

        // --- AOV (Store) ---
        const aov = ordersAll.length ? revOrders / ordersAll.length : 0;

        // 4. CHARTS GENERATION
        // Daily Bucket
        const dailyMap: Record<string, { revenue: number, orders: number }> = {};
        for (let i = 0; i < 30; i++) {
            const d = format(subDays(now, i), 'yyyy-MM-dd');
            dailyMap[d] = { revenue: 0, orders: 0 };
        }

        const addToDaily = (items: any[], type: 'donation' | 'order' | 'pilgrimage' | 'quota') => {
            // Only process items in last 30 days
            filterPeriod(items, last30Start, now).forEach(item => {
                const day = format(parseDate(item), 'yyyy-MM-dd');
                if (dailyMap[day]) {
                    dailyMap[day].revenue += getRevenue(item, type);
                    if (type === 'order') dailyMap[day].orders += 1;
                }
            });
        };

        addToDaily(donationsAll, 'donation');
        addToDaily(ordersAll, 'order');
        addToDaily(pilgrimPaymentsAll, 'pilgrimage');
        addToDaily(quotasAll, 'quota');

        const revenueTrendChart = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, d]) => ({
                date,
                revenue: Number(d.revenue.toFixed(2)),
                orders: d.orders
            }));

        const revenueDistribution = [
            { name: 'Loja', value: revOrders },
            { name: 'Doações', value: revDonations },
            { name: 'Peregrinações', value: revPilgrims },
            { name: 'Quotas', value: revQuotas }
        ].filter(i => i.value > 0);

        // 5. RECENT ACTIVITY (Mixed)
        const recentRaw = [
            ...ordersAll.map((i: any) => ({
                ...i,
                type: 'shop',
                label: 'Encomenda Loja',
                amount: getRevenue(i, 'order'),
                customer_name: i.buyer_name || 'Cliente Loja', // Fixed from customer_name logic
                date: parseDate(i)
            })),
            ...donationsAll.map((i: any) => ({
                id: i.id || Math.random().toString(),
                type: 'donation',
                label: 'Doação',
                amount: getRevenue(i, 'donation'),
                customer_name: 'Doador',
                status: i.status || 'succeeded',
                date: parseDate(i)
            })),
            ...pilgrimPaymentsAll.map((i: any) => ({
                id: i.id || Math.random().toString(),
                type: 'booking',
                label: 'Pagamento Peregrinação',
                amount: getRevenue(i, 'pilgrimage'),
                customer_name: 'Peregrino',
                status: i.status || 'verified',
                date: parseDate(i)
            })),
            ...quotasAll.map((i: any) => ({
                id: i.id || Math.random().toString(),
                type: 'quota',
                label: 'Quota',
                amount: getRevenue(i, 'quota'),
                customer_name: 'Membro',
                status: i.estado || 'pago',
                date: parseDate(i)
            }))
        ].sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, 10);

        return NextResponse.json({
            kpi: {
                revenue: { value: totalRevenue, trend: revenueTrend, last30: revLast30 },
                orders: { value: ordersAll.length, trend: ordersTrend, last30: ordLast30 },
                donations: { value: revDonations, trend: donationsTrend, last30: donLast30 },
                aov: { value: aov, trend: 0 }
            },
            charts: {
                revenueTrend: revenueTrendChart,
                revenueDistribution
            },
            tables: {
                recentTransactions: recentRaw,
                lowStock: lowStock || []
            }
        });

    } catch (error: any) {
        console.error("Dashboard CRITICAL API Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
