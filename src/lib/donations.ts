import { cache } from 'react';

export type DonationMeta = {
    goal: number;
    raised: number;
};

export const loadMeta = cache(async (): Promise<DonationMeta> => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    try {
        const res = await fetch(`${siteUrl.replace(/\/$/, '')}/api/donations/meta`, {
            cache: 'no-store',
        });
        if (!res.ok) return { goal: 2500, raised: 0 };
        const data = await res.json();
        if (typeof data?.goal === 'number' && typeof data?.raised === 'number') {
            return { goal: data.goal, raised: data.raised };
        }
    } catch {
        // ignore
    }
    return { goal: 2500, raised: 0 };
});

export const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR' }).format(value);
