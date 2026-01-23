
import { useState, useEffect } from 'react';

/**
 * useExchangeRate Hook
 * Fetches and caches the EUR to Target Currency exchange rate.
 * 
 * @param targetCurrency - The currency code to convert to (e.g., 'BRL').
 * @returns { rate, loading, error, convert, format }
 */
export const useExchangeRate = (targetCurrency: string = 'BRL') => {
    const [rate, setRate] = useState<number | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // If target is EUR, rate is 1.
        if (targetCurrency === 'EUR') {
            setRate(1);
            setLoading(false);
            return;
        }

        const fetchRate = async () => {
            try {
                // Check Cache (1 Hour validity)
                const cached = localStorage.getItem(`exchange_rate_EUR_${targetCurrency}`);
                if (cached) {
                    const { value, timestamp } = JSON.parse(cached);
                    const now = new Date().getTime();
                    if (now - timestamp < 3600000) { // 1 Hour
                        setRate(value);
                        setLoading(false);
                        return;
                    }
                }

                // Fetch from API (Free open access endpoint)
                const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
                const data = await res.json();

                const newRate = data.rates[targetCurrency];

                if (newRate) {
                    setRate(newRate);
                    localStorage.setItem(`exchange_rate_EUR_${targetCurrency}`, JSON.stringify({
                        value: newRate,
                        timestamp: new Date().getTime()
                    }));
                } else {
                    throw new Error(`Currency ${targetCurrency} not found`);
                }

            } catch (err: any) {
                console.error("Exchange rate fetch error:", err);
                setError(err.message);
                // Fallback (approximate logic or keep null)
                // We keep null so UI knows to fallback to EUR
            } finally {
                setLoading(false);
            }
        };

        fetchRate();
    }, [targetCurrency]);

    // Helper to Convert
    const convert = (amountInEur: number) => {
        if (!rate) return amountInEur;
        return amountInEur * rate;
    };

    // Helper to Format
    const format = (amountInEur: number, showSymbol = true) => {
        if (!rate || targetCurrency === 'EUR') {
            return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(amountInEur);
        }

        const converted = convert(amountInEur);
        const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: targetCurrency }).format(converted);

        // Add indicator that it is approximate
        return `${formatted}`; // Can append (aprox.) in UI if needed, kept clean here.
    };

    return { rate, loading, error, convert, format };
};
