'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getExchangeRate } from '../../lib/currency';

type Currency = 'EUR' | 'BRL' | 'USD';

interface CurrencyContextType {
    currency: Currency;
    isLoading: boolean;
    formatPrice: (amountInEur: number) => string;
    convertPrice: (amountInEur: number) => number;
    formatEUR: (amountInEur: number) => string;
    formatConverted: (amountInEur: number) => string | null;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const US_TIMEZONE_CITIES = [
    'New_York', 'Chicago', 'Denver', 'Los_Angeles', 'Phoenix', 'Anchorage',
    'Detroit', 'Indianapolis', 'Louisville', 'Boise', 'Juneau', 'Honolulu',
    'Adak', 'Nome', 'Yakutat', 'Sitka', 'Menominee', 'Metlakatla'
];

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrency] = useState<Currency>('EUR');
    const [rate, setRate] = useState<number>(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initCurrency = async () => {
            try {
                let targetCurrency: Currency = 'EUR';

                if (typeof window !== 'undefined') {
                    // 0. Check URL Override
                    const searchParams = new URLSearchParams(window.location.search);
                    const forcedCurrency = searchParams.get('currency') || searchParams.get('currecy');

                    if (forcedCurrency === 'BRL' || forcedCurrency === 'EUR' || forcedCurrency === 'USD') {
                        targetCurrency = forcedCurrency as Currency;
                        localStorage.setItem('gplus_preferred_currency', targetCurrency);
                    } else {
                        // 1. Check LocalStorage Persistent Preference
                        const savedCurrency = localStorage.getItem('gplus_preferred_currency');
                        if (savedCurrency === 'BRL' || savedCurrency === 'EUR' || savedCurrency === 'USD') {
                            targetCurrency = savedCurrency as Currency;
                        } else {
                            // 2. Automatic Detection via Locale and Timezone
                            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
                            const locale = (navigator.language || '').toLowerCase();

                            const isBrazilTz = timeZone.startsWith('America/') && [
                                'Sao_Paulo', 'Bahia', 'Belem', 'Boa_Vista', 'Campo_Grande', 'Cuiaba',
                                'Eirunepe', 'Fortaleza', 'Maceio', 'Manaus', 'Noronha', 'Porto_Velho',
                                'Recife', 'Rio_Branco', 'Santarem', 'Araguaina'
                            ].some(city => timeZone.includes(city));

                            const isBrazilLocale = locale.includes('pt-br');

                            const isUSTz = timeZone.startsWith('America/') &&
                                US_TIMEZONE_CITIES.some(city => timeZone.includes(city));
                            const isUSLocale = locale === 'en-us' || locale.startsWith('en-us');

                            if (isBrazilTz || isBrazilLocale) {
                                targetCurrency = 'BRL';
                            } else if (isUSTz || isUSLocale) {
                                targetCurrency = 'USD';
                            }
                        }
                    }
                }

                setCurrency(targetCurrency);
                if (targetCurrency !== 'EUR') {
                    const fetchedRate = await getExchangeRate(targetCurrency);
                    setRate(fetchedRate);
                }
            } catch (error) {
                console.error("Failed to detect currency:", error);
            } finally {
                setIsLoading(false);
            }
        };

        initCurrency();
    }, []);

    const convertPrice = (amountInEur: number) => {
        if (currency === 'EUR') return amountInEur;
        const raw = amountInEur * rate;
        if (currency === 'BRL') {
            return Math.round(raw / 5) * 5;
        }
        // USD: round to nearest whole dollar
        return Math.round(raw);
    };

    const formatEUR = (amountInEur: number) => {
        return new Intl.NumberFormat('pt-PT', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amountInEur);
    };

    const formatPrice = (amountInEur: number) => {
        const finalAmount = convertPrice(amountInEur);

        if (currency === 'EUR') {
            return formatEUR(amountInEur);
        }

        if (currency === 'BRL') {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(finalAmount);
        }

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(finalAmount);
    };

    const formatConverted = (amountInEur: number) => {
        if (currency === 'EUR') return null;
        return formatPrice(amountInEur);
    };

    return (
        <CurrencyContext.Provider value={{ currency, isLoading, formatPrice, convertPrice, formatEUR, formatConverted }}>
            {children}
        </CurrencyContext.Provider>
    );
}

const DEFAULT_CURRENCY_CONTEXT: CurrencyContextType = {
    currency: 'EUR',
    isLoading: false,
    formatEUR: (amount) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount),
    formatPrice: (amount) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount),
    convertPrice: (amount) => amount,
    formatConverted: () => null,
};

export function useCurrency() {
    const context = useContext(CurrencyContext);
    return context ?? DEFAULT_CURRENCY_CONTEXT;
}
