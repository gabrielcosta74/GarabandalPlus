'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getExchangeRate } from '../../lib/currency';

type Currency = 'EUR' | 'BRL';

interface CurrencyContextType {
    currency: Currency;
    isLoading: boolean;
    formatPrice: (amountInEur: number) => string;
    convertPrice: (amountInEur: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

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

                    if (forcedCurrency === 'BRL' || forcedCurrency === 'EUR') {
                        targetCurrency = forcedCurrency as Currency;
                        localStorage.setItem('gplus_preferred_currency', targetCurrency);
                    } else {
                        // 1. Check LocalStorage Persistent Preference
                        const savedCurrency = localStorage.getItem('gplus_preferred_currency');
                        if (savedCurrency === 'BRL' || savedCurrency === 'EUR') {
                            targetCurrency = savedCurrency as Currency;
                        } else {
                            // 2. Automatic Brazilian Detection via Locale and Timezone Range
                            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
                            const locale = navigator.language || '';

                            const isBrazilTz = timeZone.startsWith('America/') && [
                                'Sao_Paulo', 'Bahia', 'Belem', 'Boa_Vista', 'Campo_Grande', 'Cuiaba',
                                'Eirunepe', 'Fortaleza', 'Maceio', 'Manaus', 'Noronha', 'Porto_Velho',
                                'Recife', 'Rio_Branco', 'Santarem', 'Araguaina'
                            ].some(city => timeZone.includes(city));

                            const isBrazilLocale = locale.toLowerCase().includes('pt-br');

                            if (isBrazilTz || isBrazilLocale) {
                                targetCurrency = 'BRL';
                            }
                        }
                    }
                }

                setCurrency(targetCurrency);
                if (targetCurrency === 'BRL') {
                    const fetchedRate = await getExchangeRate('BRL');
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
        // Logic for BRL: Round to nearest 5
        const raw = amountInEur * rate;
        return Math.round(raw / 5) * 5;
    };

    const formatPrice = (amountInEur: number) => {
        const finalAmount = convertPrice(amountInEur);

        if (currency === 'EUR') {
            return new Intl.NumberFormat('pt-PT', {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(finalAmount);
        }

        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(finalAmount);
    };

    return (
        <CurrencyContext.Provider value={{ currency, isLoading, formatPrice, convertPrice }}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    const context = useContext(CurrencyContext);
    if (!context) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
}
