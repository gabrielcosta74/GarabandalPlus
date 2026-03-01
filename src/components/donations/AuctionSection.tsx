"use client";

import { useEffect, useState } from 'react';
import { Gavel } from 'lucide-react';
import { AuctionCard } from '../auction/AuctionCard';

type AuctionItem = {
    id: string;
    title: string;
    images: string[];
    starting_price: number;
    current_bid: number | null;
    total_bids: number;
    ends_at: string;
    status: string;
};

export default function AuctionSection() {
    const [items, setItems] = useState<AuctionItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const res = await fetch('/api/auction/items');
                const data = await res.json();

                // Only show active items on the donations page
                const activeItems = (data.items || []).filter(
                    (item: AuctionItem) => item.status === 'active'
                );
                setItems(activeItems);
            } catch (err) {
                console.error('[AuctionSection] Failed to load items:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchItems();
    }, []);

    // Don't render anything if no active auctions
    if (loading || items.length === 0) return null;

    return (
        <section className="py-16 md:py-24 bg-gradient-to-b from-slate-50 to-white">
            <div className="container mx-auto px-6">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-700 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest mb-4 border border-yellow-200">
                        <Gavel className="w-4 h-4" />
                        Leilão Solidário
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mb-3">
                        Peças com Alma, Causas com Coração
                    </h2>
                    <p className="text-slate-500 max-w-2xl mx-auto">
                        Peças únicas restauradas com amor. Licite e contribua diretamente para a construção da Casa do Apostolado.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {items.map(item => (
                        <AuctionCard key={item.id} item={item} />
                    ))}
                </div>
            </div>
        </section>
    );
}
