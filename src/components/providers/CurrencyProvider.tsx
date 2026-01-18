'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

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
                // 0. Check for URL Override for Testing
                if (typeof window !== 'undefined') {
                    const searchParams = new URLSearchParams(window.location.search);
                    const forcedCurrency = searchParams.get('currency');

                    if (forcedCurrency === 'BRL') {
                        setCurrency('BRL');
                        // Fetch rate even if forced
                        try {
                            const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
                            const data = await res.json();
                            if (data && data.rates && data.rates.BRL) {
                                setRate(data.rates.BRL);
                            } else {
                                setRate(6.5);
                            }
                        } catch (e) {
                            console.warn("Could not fetch rate, using fallback", e);
                            setRate(6.5);
                        }
                        setIsLoading(false);
                        return;
                    }
                }

                // 1. Detect if user is in Brazil
                const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const isBrazil = timeZone.includes('Sao_Paulo') || timeZone.includes('Brazil') || timeZone.includes('Belem') || timeZone.includes('Fortaleza') || timeZone.includes('Manaus') || timeZone.includes('Recife') || timeZone.includes('Salvador');

                if (isBrazil) {
                    setCurrency('BRL');

                    // 2. Fetch Exchange Rate
                    const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
                    const data = await res.json();
                    if (data && data.rates && data.rates.BRL) {
                        setRate(data.rates.BRL);
                    } else {
                        // Fallback safe rate
                        setRate(6.5);
                    }
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
