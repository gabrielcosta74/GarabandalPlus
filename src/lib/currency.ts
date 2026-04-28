export interface ExchangeRate {
    rate: number;
    fetchedAt: string;
}

const CACHE_PREFIX = 'garabandal_exchange_rate_EUR_';
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

const FALLBACK_RATES: Record<string, number> = {
    BRL: 6.15,
    USD: 1.08,
};

/**
 * Fetches the current EUR to target exchange rate via the local API proxy.
 * The proxy fetches Frankfurter server-side to avoid browser network restrictions.
 */
export async function getExchangeRate(targetCurrency: string = 'BRL'): Promise<number> {
    if (targetCurrency === 'EUR') return 1;

    const cacheKey = `${CACHE_PREFIX}${targetCurrency}`;

    if (typeof window !== 'undefined') {
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed: ExchangeRate = JSON.parse(cached);
                const age = Date.now() - new Date(parsed.fetchedAt).getTime();
                if (age < CACHE_DURATION) {
                    return parsed.rate;
                }
            }
        } catch { /* ignore localStorage errors */ }
    }

    try {
        const response = await fetch(`/api/exchange-rate?currency=${encodeURIComponent(targetCurrency)}`);
        const data = await response.json();

        if (typeof data.rate !== 'number') {
            throw new Error('Invalid rate');
        }

        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    rate: data.rate,
                    fetchedAt: new Date().toISOString()
                }));
            } catch { /* ignore localStorage errors */ }
        }

        return data.rate;
    } catch {
        return FALLBACK_RATES[targetCurrency] ?? 1;
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
 * Formats a value in USD currency.
 */
export function formatUSD(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
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

const US_TIMEZONE_CITIES = [
    'New_York', 'Chicago', 'Denver', 'Los_Angeles', 'Phoenix', 'Anchorage',
    'Detroit', 'Indianapolis', 'Louisville', 'Boise', 'Juneau', 'Honolulu',
    'Adak', 'Nome', 'Yakutat', 'Sitka', 'Menominee', 'Metlakatla',
    'Kentucky/Monticello', 'Indiana/Indianapolis', 'Indiana/Knox',
    'Indiana/Marengo', 'Indiana/Petersburg', 'Indiana/Tell_City',
    'Indiana/Vevay', 'Indiana/Vincennes', 'Indiana/Winamac',
    'North_Dakota/Beulah', 'North_Dakota/Center', 'North_Dakota/New_Salem'
];

/**
 * Detects if the user is likely from the United States based on locale/timezone.
 */
export function isUSUser(): boolean {
    if (typeof window === 'undefined') return false;

    const locale = navigator.language.toLowerCase();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

    const isUSTz = timeZone.startsWith('America/') &&
        US_TIMEZONE_CITIES.some(city => timeZone.includes(city));
    const isUSLocale = locale === 'en-us' || locale.startsWith('en-us');

    return isUSTz || isUSLocale;
}
