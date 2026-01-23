import { getAppUrl } from './config';

export interface ExchangeRate {
    rate: number;
    fetchedAt: string;
}

const CACHE_KEY = 'garabandal_exchange_rate_eur_brl';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetches the current EUR to BRL exchange rate.
 * Uses a public API (Frankfurter) and handles caching.
 */
export async function getExchangeRate(): Promise<number> {
    // Try to get from local storage if in browser
    if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const parsed: ExchangeRate = JSON.parse(cached);
            const age = Date.now() - new Date(parsed.fetchedAt).getTime();
            if (age < CACHE_DURATION) {
                return parsed.rate;
            }
        }
    }

    try {
        const response = await fetch('https://api.frankfurter.app/latest?from=EUR&to=BRL');
        const data = await response.json();
        const rate = data.rates.BRL;

        if (typeof window !== 'undefined') {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                rate,
                fetchedAt: new Date().toISOString()
            }));
        }

        return rate;
    } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
        return 6.15; // Realistic fallback for early 2026 if API fails
    }
}

/**
 * Formats a value in BRL currency.
 */
export function formatBRL(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

/**
 * Detects if the user is likely from Brazil based on locale/timezone.
 */
export function isBrazilUser(): boolean {
    if (typeof window === 'undefined') return false;

    const locale = navigator.language.toLowerCase();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return locale.includes('pt-br') || timeZone.includes('Sao_Paulo') || timeZone.includes('Brazil');
}
