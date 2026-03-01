"use client";

import { useEffect, useState } from 'react';

interface AuctionCountdownProps {
    endsAt: string;
    className?: string;
}

export function AuctionCountdown({ endsAt, className = '' }: AuctionCountdownProps) {
    const [timeLeft, setTimeLeft] = useState('');
    const [isExpired, setIsExpired] = useState(false);
    const [isUrgent, setIsUrgent] = useState(false);

    useEffect(() => {
        const calculate = () => {
            const now = new Date().getTime();
            const end = new Date(endsAt).getTime();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft('Encerrado');
                setIsExpired(true);
                return;
            }

            setIsUrgent(diff < 24 * 60 * 60 * 1000); // Less than 24h

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            if (days > 0) {
                setTimeLeft(`${days}d ${hours}h ${minutes}m`);
            } else if (hours > 0) {
                setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
            } else {
                setTimeLeft(`${minutes}m ${seconds}s`);
            }
        };

        calculate();
        const interval = setInterval(calculate, 1000);
        return () => clearInterval(interval);
    }, [endsAt]);

    if (isExpired) {
        return (
            <span className={`text-red-600 font-bold ${className}`}>
                Encerrado
            </span>
        );
    }

    return (
        <span className={`font-mono font-bold tabular-nums ${isUrgent ? 'text-red-600 animate-pulse' : 'text-slate-700'} ${className}`}>
            {timeLeft}
        </span>
    );
}
