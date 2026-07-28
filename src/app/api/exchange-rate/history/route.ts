import { NextRequest, NextResponse } from 'next/server';

const SUPPORTED_CURRENCIES = ['BRL', 'USD'] as const;
const FALLBACK_RATES: Record<(typeof SUPPORTED_CURRENCIES)[number], number> = {
    BRL: 6.15,
    USD: 1.08,
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency')?.toUpperCase();
    const requestedDays = Number(searchParams.get('days') || 30);
    const days = Number.isFinite(requestedDays)
        ? Math.min(90, Math.max(7, Math.round(requestedDays)))
        : 30;

    if (!currency || !SUPPORTED_CURRENCIES.includes(currency as (typeof SUPPORTED_CURRENCIES)[number])) {
        return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }

    const targetCurrency = currency as (typeof SUPPORTED_CURRENCIES)[number];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setUTCDate(endDate.getUTCDate() - days);

    try {
        const response = await fetch(
            `https://api.frankfurter.app/${toIsoDate(startDate)}..${toIsoDate(endDate)}?from=EUR&to=${targetCurrency}`,
            { next: { revalidate: 21600 } },
        );

        if (!response.ok) {
            throw new Error(`Frankfurter responded with ${response.status}`);
        }

        const data = await response.json();
        const points = Object.entries(data?.rates || {})
            .map(([date, rates]) => ({
                date,
                rate: Number((rates as Record<string, number>)?.[targetCurrency]),
            }))
            .filter((point) => Number.isFinite(point.rate))
            .sort((a, b) => a.date.localeCompare(b.date));

        if (points.length < 2) {
            throw new Error('Insufficient exchange-rate history');
        }

        return NextResponse.json(
            {
                base: 'EUR',
                currency: targetCurrency,
                days,
                points,
                fetchedAt: new Date().toISOString(),
            },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
                },
            },
        );
    } catch {
        const baseRate = FALLBACK_RATES[targetCurrency];
        const points = Array.from({ length: 8 }, (_, index) => {
            const date = new Date(startDate);
            date.setUTCDate(startDate.getUTCDate() + Math.round((days / 7) * index));
            const variation = Math.sin(index * 1.35) * 0.012 + (index - 3.5) * 0.0012;
            return {
                date: toIsoDate(date),
                rate: Number((baseRate * (1 + variation)).toFixed(4)),
            };
        });

        return NextResponse.json(
            {
                base: 'EUR',
                currency: targetCurrency,
                days,
                points,
                fallback: true,
                fetchedAt: new Date().toISOString(),
            },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=300',
                },
            },
        );
    }
}
