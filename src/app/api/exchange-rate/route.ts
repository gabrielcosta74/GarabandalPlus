import { NextRequest, NextResponse } from 'next/server';

// Fallback rates EUR → target (updated manually when API is unavailable)
const FALLBACK_RATES: Record<string, number> = {
    BRL: 6.15,
    USD: 1.08,
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency');

    if (!currency || !['BRL', 'USD'].includes(currency)) {
        return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }

    try {
        const response = await fetch(
            `https://api.frankfurter.app/latest?from=EUR&to=${currency}`,
            { next: { revalidate: 3600 } } // Cache for 1 hour on server
        );

        if (!response.ok) {
            throw new Error(`Frankfurter responded with ${response.status}`);
        }

        const data = await response.json();
        const rate = data?.rates?.[currency];

        if (typeof rate !== 'number') {
            throw new Error('Rate not found in response');
        }

        return NextResponse.json(
            { rate, currency, fetchedAt: new Date().toISOString() },
            { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
        );
    } catch {
        return NextResponse.json(
            { rate: FALLBACK_RATES[currency] ?? 1, currency, fallback: true },
            { headers: { 'Cache-Control': 'public, s-maxage=300' } }
        );
    }
}
