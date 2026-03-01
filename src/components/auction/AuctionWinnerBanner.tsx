"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, X, Clock } from 'lucide-react';
import { supabaseBrowser } from '../../lib/supabase-browser';

type WonItem = {
    id: string;
    title: string;
    current_bid: number;
    payment_deadline: string;
};

/**
 * Global banner that appears site-wide when the user has won an auction
 * and needs to pay. Positioned fixed below the navbar (h-20 = top-20).
 */
export function AuctionWinnerBanner() {
    const [wonItems, setWonItems] = useState<WonItem[]>([]);
    const [dismissed, setDismissed] = useState<string[]>([]);

    useEffect(() => {
        const check = async () => {
            if (!supabaseBrowser) return;
            const { data: session } = await supabaseBrowser.auth.getSession();
            const userId = session?.session?.user?.id;
            if (!userId) return;

            const { data } = await supabaseBrowser
                .from('auction_items')
                .select('id, title, current_bid, payment_deadline')
                .eq('winner_id', userId)
                .eq('status', 'awaiting_payment');

            if (data && data.length > 0) {
                setWonItems(data as WonItem[]);
            }
        };

        check();
    }, []);

    const visibleItems = wonItems.filter(item => !dismissed.includes(item.id));
    if (visibleItems.length === 0) return null;

    return (
        <>
            {/* Fixed banner below the navbar */}
            <div className="fixed top-20 left-0 right-0 z-[99] bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20">
                {visibleItems.map(item => {
                    const deadline = new Date(item.payment_deadline);
                    const hoursLeft = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60)));

                    return (
                        <div key={item.id} className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
                            <Link
                                href={`/leilao/${item.id}`}
                                className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                            >
                                <Trophy className="w-5 h-5 shrink-0" />
                                <span className="text-sm font-bold truncate">
                                    🎉 Ganhou &quot;{item.title}&quot;! Pague {(item.current_bid / 100).toFixed(0)}€
                                </span>
                                <span className="hidden sm:inline text-xs font-semibold bg-slate-900/10 px-3 py-1 rounded-full whitespace-nowrap">
                                    <Clock className="w-3 h-3 inline mr-1" />
                                    {hoursLeft}h restantes → Pagar agora
                                </span>
                            </Link>
                            <button
                                onClick={() => setDismissed(prev => [...prev, item.id])}
                                className="p-1 hover:bg-black/10 rounded-lg transition-colors shrink-0"
                                aria-label="Fechar"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
            {/* Spacer to push page content below the banner */}
            <div style={{ height: `${visibleItems.length * 44}px` }} />
        </>
    );
}
