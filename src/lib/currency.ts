import { getAppUrl } from './config';

export interface ExchangeRate {
    rate: number;
    fetchedAt: string;
}

const CACHE_PREFIX = 'garabandal_exchange_rate_EUR_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetches the current EUR to target exchange rate.
 * Uses a public API (Frankfurter) and handles caching.
 */
export async function getExchangeRate(targetCurrency: string = 'BRL'): Promise<number> {
    if (targetCurrency === 'EUR') return 1;

    const cacheKey = `${CACHE_PREFIX}${targetCurrency}`;

    // Try to get from local storage if in browser
    if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsed: ExchangeRate = JSON.parse(cached);
            const age = Date.now() - new Date(parsed.fetchedAt).getTime();
            if (age < CACHE_DURATION) {
                return parsed.rate;
            }
        }
    }

    try {
        const response = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${encodeURIComponent(targetCurrency)}`);
        const data = await response.json();
        const rate = data?.rates?.[targetCurrency];

        if (typeof rate !== 'number') {
            throw new Error(`Currency ${targetCurrency} not found`);
        }

        if (typeof window !== 'undefined') {
            localStorage.setItem(cacheKey, JSON.stringify({
                rate,
                fetchedAt: new Date().toISOString()
            }));
        }

        return rate;
    } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
        if (targetCurrency === 'BRL') {
            return 6.15; // Realistic fallback for early 2026 if API fails
        }
        return 1;
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
