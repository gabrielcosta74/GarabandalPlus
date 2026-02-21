"use client";

import { useCurrency } from "../providers/CurrencyProvider";

export function DynamicReward({ amount }: { amount: number }) {
    const { formatPrice } = useCurrency();
    return <>{formatPrice(amount)}</>;
}
